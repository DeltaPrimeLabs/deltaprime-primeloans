import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    Asset,
    deployAllFacets,
    deployAndInitializeLendingPool, formatUnits,
    fromWei,
    getFixedGasSigners,
    PoolAsset,
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
    TokenManager, TraderJoeIntermediary,
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

    describe('A loan with staking operations', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            lpTokenAddress: string,
            lpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            tokenContracts: any = {},
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            yakLPStakingContract: Contract,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            USD_PRICE: number,
            tjLPTokenPrice: number,
            yyTJLPTokenPrice: number,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

            let lendingPools = [];
            // TODO: Possibly further extract the body of this for loop into a separate function shared among test suits
            for (const token of [
                {'name': 'AVAX', 'airdropList': [depositor]}
            ]) {
                let {
                    poolContract,
                    tokenContract
                } = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
                await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                await poolContract.connect(depositor).deposit(toWei("1000"));
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                tokenContracts[token.name] = tokenContract;
            }

            AVAX_PRICE = (await redstone.getPrice('AVAX', {provider: "redstone-avalanche-prod-1"})).value;
            USD_PRICE = (await redstone.getPrice('USDC', {provider: "redstone-avalanche-prod-1"})).value;

            tokenContracts['TJ_AVAX_USDC'] = new ethers.Contract(TOKEN_ADDRESSES['TJ_AVAX_USDC'], lpABI, provider);
            tokenContracts['YY_TJ_AVAX_USDC'] = new ethers.Contract(TOKEN_ADDRESSES['YY_TJ_AVAX_USDC'], lpABI, provider);

            let lpTokenTotalSupply = await tokenContracts['TJ_AVAX_USDC'].totalSupply();
            let [lpTokenToken0Reserve, lpTokenToken1Reserve] = (await tokenContracts['TJ_AVAX_USDC'].getReserves());

            let token0USDValue = fromWei(lpTokenToken0Reserve) * AVAX_PRICE;
            let token1USDValue = formatUnits(lpTokenToken1Reserve, BigNumber.from("6")) * USD_PRICE;


            tjLPTokenPrice = (token0USDValue + token1USDValue) / fromWei(lpTokenTotalSupply);
            let yyTotalSupply = await tokenContracts['YY_TJ_AVAX_USDC'].totalSupply();
            let yyTotalDeposits = await tokenContracts['YY_TJ_AVAX_USDC'].totalDeposits();
            yyTJLPTokenPrice = tjLPTokenPrice * fromWei(yyTotalDeposits) / fromWei(yyTotalSupply)

            let supportedAssets = [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                new Asset(toBytes32('TJ_AVAX_USDC'), TOKEN_ADDRESSES['TJ_AVAX_USDC']),
                new Asset(toBytes32('YY_TJ_AVAX_USDC'), TOKEN_ADDRESSES['YY_TJ_AVAX_USDC'])
            ]

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

            let exchangeFactory = await ethers.getContractFactory("TraderJoeIntermediary");
            exchange = (await exchangeFactory.deploy()).connect(owner) as TraderJoeIntermediary;
            await exchange.initialize(traderJoeRouterAddress, supportedAssets.map(asset => asset.assetAddress));

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

            MOCK_PRICES = [
                {
                    symbol: 'USDC',
                    value: USD_PRICE
                },
                {
                    symbol: 'AVAX',
                    value: AVAX_PRICE
                },
                {
                    symbol: 'TJ_AVAX_USDC',
                    value: tjLPTokenPrice
                },
                {
                    symbol: 'YY_TJ_AVAX_USDC',
                    value: yyTJLPTokenPrice
                },
            ]

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
            await tokenContracts['AVAX'].connect(owner).deposit({value: toWei("500")});
            await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("500"));
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
                parseUnits((AVAX_PRICE * 180).toFixed(6), BigNumber.from("6")),
                toWei("160"),
                parseUnits((AVAX_PRICE * 160).toFixed(6), BigNumber.from("6"))
            );

            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts['YY_TJ_AVAX_USDC'].balanceOf(wrappedLoan.address);
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());

            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeTJAVAXUSDCYak(initialTJAVAXUSDCBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts['YY_TJ_AVAX_USDC'].balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);
p
            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
        });

        it("should unstake TJ LP tokens on YY", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialStakedBalance = await tokenContracts['YY_TJ_AVAX_USDC'].balanceOf(wrappedLoan.address);
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);

            expect(initialTJAVAXUSDCBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeTJAVAXUSDCYak(initialStakedBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts['YY_TJ_AVAX_USDC'].balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
        });
    });
});

