import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    LiquidationFlashloan,
    PangolinIntermediary,
    RedstoneConfigManager__factory,
    SmartLoansFactory,
    TokenManager
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {liquidateLoan} from '../../../tools/liquidation/liquidation-bot-flashloan';
import redstone from "redstone-api";
import {parseUnits} from "ethers/lib/utils";
import fs from "fs";
import path from "path";
import TRUSTED_SIGNERS from '../../../common/redstone-trusted-signers.json';

const { deployDiamond, replaceFacet } = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const { deployContract } = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const aavePoolAddressesProviderAdress = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';


const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "../../../tools/liquidation/.private")).toString().trim();
const rpcProvider = new ethers.providers.JsonRpcProvider()
const liquidatorWallet = (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(rpcProvider);

describe('Test liquidator with a flashloan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    // describe('A loan with debt and repayment', () => {
    //     let exchange: PangolinIntermediary,
    //         smartLoansFactory: SmartLoansFactory,
    //         loan: Contract,
    //         wrappedLoan: any,
    //         redstoneConfigManager: any,
    //         tokenManager: any,
    //         MOCK_PRICES: any,
    //         poolContracts: Map<string, Contract> = new Map(),
    //         tokenContracts: Map<string, Contract> = new Map(),
    //         lendingPools: Array<PoolAsset> = [],
    //         supportedAssets: Array<Asset>,
    //         tokensPrices: Map<string, number>,
    //         owner: SignerWithAddress,
    //         depositor: SignerWithAddress,
    //         borrower: SignerWithAddress,
    //         diamondAddress: any,
    //         liquidationFlashloan: LiquidationFlashloan;
    //
    //
    //     before("deploy factory, exchange, wavaxPool and usdPool", async () => {
    //         console.log('before');
    //         [owner, depositor, borrower] = await getFixedGasSigners(10000000);
    //         let assetsList = ['AVAX', 'USDC'];
    //         let poolNameAirdropList: Array<PoolInitializationObject> = [
    //             {name: 'AVAX', airdropList: [borrower, depositor]},
    //             {name: 'USDC', airdropList: []}
    //         ];
    //
    //         redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(
    //                 [
    //                     "0xFE71e9691B9524BC932C23d0EeD5c9CE41161884",
    //                     "0x1cd8f9627a2838a7dae6b98cf71c08b9cbf5174a",
    //                     "0x981bda8276ae93f567922497153de7a5683708d3",
    //                     "0x3befdd935b50f172e696a5187dbacfef0d208e48",
    //                     "0xc1d5b940659e57b7bdf8870cdfc43f41ca699460",
    //                     "0xbc5a06815ee80de7d20071703c1f1b8fc511c7d4",
    //                     "0x496f4e8ac11076350a59b88d2ad62bc20d410ea3",
    //                     "0xe9fa2869c5f6fc3a0933981825564fd90573a86d",
    //                     "0xdf6b1ca313bee470d0142279791fa760abf5c537",
    //                     "0xa50abc5D76dAb99d5fe59FD32f239Bd37d55025f",
    //                     "0x41FB6b8d0f586E73d575bC57CFD29142B3214A47",
    //                     "0xC1068312a6333e6601f937c4773065B70D38A5bF",
    //                     "0xAE9D49Ea64DF38B9fcbC238bc7004a1421f7eeE8",
    //                     "0x2BC37a0368E86cA0d14Bc8788D45c75deabaC064",
    //                     "0x9277491f485460575918B43f5d6D5b2BB8c5A62d",
    //                     "0x91dC1fe6472e18Fd2C9407e438dD022f22891a4f",
    //                     "0x4bbb86992E94AA209c52ecfd38897A18bde8E39D",
    //                     "0x9456dd79c3608cF463d975F76f7658f87a41Cd6C",
    //                     "0x4C6f83Faa74106139FcB08d4E49568e0Df222815",
    //                     "0x4CF8310ABAe9CA2ACD85f460B509eE495F36eFAF",
    //                     "0x2D0645D863a4eE15664761ea1d99fF2bae8aAe35",
    //                     "0xF5c14165fb10Ac4926d52504a9B45550411A3C0F",
    //                     "0x11D23F3dbf8B8e1cf61AeF77A2ea0592Bc9860E0",
    //                     "0x60930D9f74811B525356E68D23977baEAb7706d0",
    //                 ])
    //         );
    //
    //         await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
    //         tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
    //         MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
    //         supportedAssets = convertAssetsListToSupportedAssets(assetsList);
    //         addMissingTokenContracts(tokenContracts, assetsList);
    //
    //         //load liquidator wallet
    //         await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});
    //
    //         tokenManager = await deployContract(
    //             owner,
    //             TokenManagerArtifact,
    //             [
    //                 supportedAssets,
    //                 lendingPools
    //             ]
    //         ) as TokenManager;
    //
    //         diamondAddress = await deployDiamond();
    //
    //         await recompileConstantsFile(
    //             'local',
    //             "DeploymentConstants",
    //             [],
    //             tokenManager.address,
    //             redstoneConfigManager.address,
    //             diamondAddress,
    //             ethers.constants.AddressZero,
    //             'lib'
    //         );
    //
    //         exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;
    //
    //         smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
    //         await smartLoansFactory.initialize(diamondAddress);
    //
    //         await recompileConstantsFile(
    //             'local',
    //             "DeploymentConstants",
    //             [
    //                 {
    //                     facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
    //                     contractAddress: exchange.address,
    //                 }
    //             ],
    //             tokenManager.address,
    //             redstoneConfigManager.address,
    //             diamondAddress,
    //             smartLoansFactory.address,
    //             'lib'
    //         );
    //         await deployAllFacets(diamondAddress);
    //         await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
    //
    //         // Deploy flash loan liquidation contract
    //         const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');
    //
    //         liquidationFlashloan = await LiquidationFlashloan.deploy(
    //             aavePoolAddressesProviderAdress,
    //             pangolinRouterAddress,
    //             wavaxTokenAddress
    //         ) as LiquidationFlashloan;
    //     });
    //
    //
    //     it("should deploy a smart loan", async () => {
    //         await smartLoansFactory.connect(borrower).createLoan();
    //
    //         const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
    //
    //         loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);
    //
    //         wrappedLoan = WrapperBuilder
    //             .wrapLite(loan)
    //             .usingPriceFeed("redstone-avalanche-prod")
    //     });
    //
    //
    //     it("should fund, borrow and withdraw, making loan LTV higher than 500%", async () => {
    //         await tokenContracts.get('AVAX')!.connect(borrower).deposit({ value: toWei("100") });
    //         await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
    //         await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
    //
    //         const AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
    //
    //         await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));
    //
    //         await wrappedLoan.swapPangolin(
    //             toBytes32('AVAX'),
    //             toBytes32('USDC'),
    //             toWei("700"),
    //             parseUnits((0.97 * 700 * AVAX_PRICE).toFixed(6), BigNumber.from("6")) //todo: .97
    //         );
    //
    //         expect((await wrappedLoan.getLTV()).toNumber()).to.be.gt(5000);
    //     });
    //
    //     it("replace facet", async () => {
    //         await replaceFacet('SolvencyFacet', diamondAddress, ['isSolvent']);
    //
    //         expect(await wrappedLoan.isSolvent()).to.be.false;
    //     });
    //
    //     it("liquidate loan", async () => {
    //         await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);
    //
    //         expect(await wrappedLoan.isSolvent()).to.be.true;
    //     });
    // });

    describe('A loan with debt and repayment in multiple tokens', () => {
        let exchange: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            wrappedLoan: any,
            redstoneConfigManager: any,
            tokenManager: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            borrower: SignerWithAddress,
            diamondAddress: any,
            liquidationFlashloan: LiquidationFlashloan;


        before("deploy factory, exchange, wavaxPool and usdPool", async () => {
            console.log('before');
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH', 'BTC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: []}
            ];

            redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(TRUSTED_SIGNERS.signers));

            await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            diamondAddress = await deployDiamond();

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress);
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                pangolinRouterAddress,
                wavaxTokenAddress
            ) as LiquidationFlashloan;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            wrappedLoan = WrapperBuilder
                .wrapLite(loan)
                .usingPriceFeed("redstone-avalanche-prod")
        });


        it("should fund, borrow and withdraw, making loan LTV higher than 500%", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({ value: toWei("100") });
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            const AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            const ETH_PRICE = (await redstone.getPrice('ETH')).value;
            const BTC_PRICE = (await redstone.getPrice('BTC')).value;

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("200"),
                parseUnits((0.97 * 200 * AVAX_PRICE).toFixed(6), BigNumber.from("6")) //todo: .97
            );

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('ETH'),
                toWei("500"),
                parseUnits((0.97 * 500 * AVAX_PRICE / ETH_PRICE).toFixed(18), BigNumber.from("18")) //todo: .97
            );

            console.log(`AVAX_PRICE: ${AVAX_PRICE}`)
            console.log(`ETH_PRICE: ${ETH_PRICE}`)
            console.log(`AVAX_PRICE/ETH_PRICE: ${AVAX_PRICE/ETH_PRICE}`)
            console.log(`Minimum bought (ETH): ${parseUnits((0.9 * 500 * AVAX_PRICE / ETH_PRICE).toFixed(18), BigNumber.from("18"))}`)

            // await wrappedLoan.swapPangolin(
            //     toBytes32('AVAX'),
            //     toBytes32('BTC'),
            //     toWei("300"),
            //     parseUnits((0.97 * 300 * AVAX_PRICE / BTC_PRICE).toFixed(8), BigNumber.from("8")) //todo: .97
            // );

            expect((await wrappedLoan.getLTV()).toNumber()).to.be.gt(5000);
        });

        it("replace facet", async () => {
            await replaceFacet('SolvencyFacet', diamondAddress, ['isSolvent']);

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

