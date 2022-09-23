import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    formatUnits,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    RedstoneConfigManager__factory,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
    TraderJoeIntermediary,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function totalDeposits() external view returns (uint256)'
]

const lpABI = [
    ...erc20ABI,
    'function getReserves() public view returns (uint112, uint112, uint32)',
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]
const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';
const yakStakingLPTJAVAXUSDCTokenAddress = "0xdef94a13ff31fb6363f1e03bf18fe0f59db83bbc";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking TJ LP tokens on YY', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            lpTokenAddress: string,
            lpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            tjLPTokenPrice: number,
            yyTJLPTokenPrice: number,
            diamondAddress: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'TJ_AVAX_USDC', 'YY_TJ_AVAX_USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));
            await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['TJ_AVAX_USDC', 'YY_TJ_AVAX_USDC'].includes(el))), getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('TJ_AVAX_USDC', new ethers.Contract(TOKEN_ADDRESSES['TJ_AVAX_USDC'], lpABI, provider));
            tokenContracts.set('YY_TJ_AVAX_USDC', new ethers.Contract(TOKEN_ADDRESSES['YY_TJ_AVAX_USDC'], lpABI, provider));

            let lpTokenTotalSupply = await tokenContracts.get('TJ_AVAX_USDC')!.totalSupply();
            let [lpTokenToken0Reserve, lpTokenToken1Reserve] = await tokenContracts.get('TJ_AVAX_USDC')!.getReserves();
            let token0USDValue = fromWei(lpTokenToken0Reserve) * tokensPrices.get('AVAX')!;
            let token1USDValue = formatUnits(lpTokenToken1Reserve, BigNumber.from("6")) * tokensPrices.get('USDC')!;
            tjLPTokenPrice = (token0USDValue + token1USDValue) / fromWei(lpTokenTotalSupply);
            let yyTotalSupply = await tokenContracts.get('YY_TJ_AVAX_USDC')!.totalSupply();
            let yyTotalDeposits = await tokenContracts.get('YY_TJ_AVAX_USDC')!.totalDeposits();
            yyTJLPTokenPrice = tjLPTokenPrice * fromWei(yyTotalDeposits) / fromWei(yyTotalSupply)

            tokensPrices = await getTokensPricesMap(
                [],
                getRedstonePrices,
                [
                        {symbol: 'TJ_AVAX_USDC', value: tjLPTokenPrice},
                        {symbol: 'YY_TJ_AVAX_USDC', value: yyTJLPTokenPrice},
                    ],
                tokensPrices
            );
            addMissingTokenContracts(tokenContracts, assetsList);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            diamondAddress = await deployDiamond();


            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            lpTokenAddress = await exchange.connect(owner).getPair(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']);
            lpToken = new ethers.Contract(lpTokenAddress, erc20ABI, provider);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );


            await deployAllFacets(diamondAddress)
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            tokensPrices = await getTokensPricesMap(['AVAX', 'USDC'], getRedstonePrices,
                [{
                symbol: 'TJ_AVAX_USDC',
                value: tjLPTokenPrice
            },
                {
                    symbol: 'YY_TJ_AVAX_USDC',
                    value: yyTJLPTokenPrice
                }]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })

            nonOwnerWrappedLoan = WrapperBuilder
                .mockLite(loan.connect(depositor))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
        });

        it("should swap", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("500")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("500"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("500"));

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('200'),
                0
            );
        });

        it("should stake TJ LP tokens on YY", async () => {
            await wrappedLoan.addLiquidityTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("180"),
                parseUnits((tokensPrices.get('AVAX')! * 180).toFixed(6), BigNumber.from("6")),
                toWei("160"),
                parseUnits((tokensPrices.get('AVAX')! * 160).toFixed(6), BigNumber.from("6"))
            );

            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC')!.balanceOf(wrappedLoan.address);
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());

            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeTJAVAXUSDCYak(initialTJAVAXUSDCBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
        });

        it("should unstake TJ LP tokens on YY", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC')!.balanceOf(wrappedLoan.address);
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);

            expect(initialTJAVAXUSDCBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeTJAVAXUSDCYak(initialStakedBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
        });
    });
});

