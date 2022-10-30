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
import {WrapperBuilder} from "@redstone-finance/evm-connector";
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
import redstone from "redstone-api";

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
    'function balance() public view returns (uint256 balance)',
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
            tokenManager: TokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'TJ_AVAX_USDC_LP', 'YY_TJ_AVAX_USDC_LP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['TJ_AVAX_USDC_LP', 'YY_TJ_AVAX_USDC_LP'].includes(el))), getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['TJ_AVAX_USDC_LP'], lpABI, provider));
            tokenContracts.set('YY_TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['YY_TJ_AVAX_USDC_LP'], lpABI, provider));

            tokensPrices = await getTokensPricesMap(
                [],
                getRedstonePrices,
                [
                        {symbol: 'TJ_AVAX_USDC_LP', value: tjLPTokenPrice},
                        {symbol: 'YY_TJ_AVAX_USDC_LP', value: yyTJLPTokenPrice},
                    ],
                tokensPrices
            );
            addMissingTokenContracts(tokenContracts, assetsList);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

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
                symbol: 'TJ_AVAX_USDC_LP',
                value: (await redstone.getPrice('TJ_AVAX_USDC_LP', {provider: "redstone-avalanche-prod-1"})).value
            },
                {
                    symbol: 'YY_TJ_AVAX_USDC_LP',
                    value: (await redstone.getPrice('YY_TJ_AVAX_USDC_LP', {provider: "redstone-avalanche-prod-1"})).value
                }]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should swap and addLiquidity on TJ", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("500")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("500"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("500"));

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('200'),
                0
            );

            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.equal(0);
            await wrappedLoan.addLiquidityTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("180"),
                parseUnits((tokensPrices.get('AVAX')! * 180).toFixed(6), BigNumber.from("6")),
                toWei("160"),
                parseUnits((tokensPrices.get('AVAX')! * 160).toFixed(6), BigNumber.from("6"))
            );
            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);
        });


        it("should fail to stake TJ LP tokens on YY", async () => {
            await tokenManager.deactivateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await tokenManager.deactivateToken(tokenContracts.get("YY_TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTJAVAXUSDCYak(1)).to.be.revertedWith("Token not supported");

            await tokenManager.activateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTJAVAXUSDCYak(1)).to.be.revertedWith("Vault token not supported");

            await tokenManager.activateToken(tokenContracts.get("YY_TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTJAVAXUSDCYak(toWei("9999"))).to.be.revertedWith("Not enough token available");
        });



        it("should stake TJ LP tokens on YY", async () => {
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());

            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeTJAVAXUSDCYak(initialTJAVAXUSDCBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);

            let totalValueDifference = initialTotalValue - fromWei(await wrappedLoan.getTotalValue());

            await expect(totalValueDifference).to.be.closeTo(0, 1);
        });

        it("should fail to unstake TJ LP tokens from YY", async () => {
            await expect(wrappedLoan.unstakeTJAVAXUSDCYak(toWei("9999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
        });

        it("should unstake TJ LP tokens from YY", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);

            expect(initialTJAVAXUSDCBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeTJAVAXUSDCYak(initialStakedBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('YY_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 1);
        });
    });

    describe('A loan with staking TJ LP tokens on BeefyFinance', () => {
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
            tokenManager: TokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'TJ_AVAX_USDC_LP', 'MOO_TJ_AVAX_USDC_LP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => !(['TJ_AVAX_USDC_LP', 'MOO_TJ_AVAX_USDC_LP'].includes(el))), getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['TJ_AVAX_USDC_LP'], lpABI, provider));
            tokenContracts.set('MOO_TJ_AVAX_USDC_LP', new ethers.Contract(TOKEN_ADDRESSES['MOO_TJ_AVAX_USDC_LP'], lpABI, provider));

            let lpTokenTotalSupply = await tokenContracts.get('TJ_AVAX_USDC_LP')!.totalSupply();
            let [lpTokenToken0Reserve, lpTokenToken1Reserve] = await tokenContracts.get('TJ_AVAX_USDC_LP')!.getReserves();
            let token0USDValue = fromWei(lpTokenToken0Reserve) * tokensPrices.get('AVAX')!;
            let token1USDValue = formatUnits(lpTokenToken1Reserve, BigNumber.from("6")) * tokensPrices.get('USDC')!;
            tjLPTokenPrice = (token0USDValue + token1USDValue) / fromWei(lpTokenTotalSupply);
            let bfTotalSupply = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.totalSupply();
            let bfTotalDeposits = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balance();
            yyTJLPTokenPrice = tjLPTokenPrice * fromWei(bfTotalDeposits) / fromWei(bfTotalSupply)


            tokensPrices = await getTokensPricesMap(
                [],
                getRedstonePrices,
                [
                    {symbol: 'TJ_AVAX_USDC_LP', value: tjLPTokenPrice},
                    {symbol: 'MOO_TJ_AVAX_USDC_LP', value: yyTJLPTokenPrice},
                ],
                tokensPrices
            );
            addMissingTokenContracts(tokenContracts, assetsList);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

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
                    symbol: 'TJ_AVAX_USDC_LP',
                    value: tjLPTokenPrice
                },
                    {
                        symbol: 'MOO_TJ_AVAX_USDC_LP',
                        value: yyTJLPTokenPrice
                    }]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should swap and addLiquidity on TJ", async () => {
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("500")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("500"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("500"));

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('200'),
                0
            );

            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.equal(0);
            await wrappedLoan.addLiquidityTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("180"),
                parseUnits((tokensPrices.get('AVAX')! * 180).toFixed(6), BigNumber.from("6")),
                toWei("160"),
                parseUnits((tokensPrices.get('AVAX')! * 160).toFixed(6), BigNumber.from("6"))
            );
            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);
        });


        it("should fail to stake TJ LP tokens on YY", async () => {
            await tokenManager.deactivateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await tokenManager.deactivateToken(tokenContracts.get("MOO_TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTjUsdcAvaxLpBeefy(1)).to.be.revertedWith("LP token not supported");

            await tokenManager.activateToken(tokenContracts.get("TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTjUsdcAvaxLpBeefy(1)).to.be.revertedWith("Vault token not supported");

            await tokenManager.activateToken(tokenContracts.get("MOO_TJ_AVAX_USDC_LP")!.address);
            await expect(wrappedLoan.stakeTjUsdcAvaxLpBeefy(toWei("9999"))).to.be.revertedWith("Not enough LP token available");
        });



        it("should stake TJ LP tokens on YY", async () => {
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let initialStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());

            expect(initialTJAVAXUSDCBalance).to.be.gt(0);
            expect(initialStakedBalance).to.be.eq(0);

            await wrappedLoan.stakeTjUsdcAvaxLpBeefy(initialTJAVAXUSDCBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.eq(0);
            expect(endStakedBalance).to.be.gt(0);

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
        });

        it("should fail to unstake TJ LP tokens from YY", async () => {
            await expect(wrappedLoan.unstakeTjUsdcAvaxLpBeefy(toWei("9999"))).to.be.revertedWith("Cannot unstake more than was initially staked");
        });

        it("should unstake TJ LP tokens from YY", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);
            let initialTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);

            expect(initialTJAVAXUSDCBalance).to.be.eq(0);
            expect(initialStakedBalance).to.be.gt(0);

            await wrappedLoan.unstakeTjUsdcAvaxLpBeefy(initialStakedBalance);

            let endTJAVAXUSDCBalance = await lpToken.balanceOf(wrappedLoan.address);
            let endStakedBalance = await tokenContracts.get('MOO_TJ_AVAX_USDC_LP')!.balanceOf(wrappedLoan.address);

            expect(endTJAVAXUSDCBalance).to.be.gt(0);
            expect(endStakedBalance).to.be.eq(0);

            const withdrawalFee = 0.001;    // 0.1 %
            const expectedDelta = initialTotalValue * withdrawalFee

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, expectedDelta);
        });
    });
});

