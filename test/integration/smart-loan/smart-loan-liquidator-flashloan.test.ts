import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, wavaxAbi, ZERO,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    AddressProvider,
    TraderJoeIntermediary,
    SmartLoansFactory,
    LiquidationFlashloan, MockTokenManager, PangolinIntermediary
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {liquidateLoan} from '../../../tools/liquidation/liquidation-bot-flashloan';
import {parseUnits} from "ethers/lib/utils";
import fs from "fs";
import path from "path";
import CACHE_LAYER_URLS from '../../../common/redstone-cache-layer-urls.json';
import TOKEN_ADDRESSES from "../../../common/addresses/avalanche/token_addresses.json";

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';
const pangolinRouterAddress = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const aavePoolAddressesProviderAdress = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';

const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "../../../tools/liquidation/.private")).toString().trim();
const rpcProvider = new ethers.providers.JsonRpcProvider()
const liquidatorWallet = (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(rpcProvider);

describe('Test liquidator with a flashloan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with debt and repayment', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            wrappedLoan: any,
            tokenManager: any,
            MOCK_PRICES: any,
            diamondCut: Contract,
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


        before("deploy factory, exchange, wavaxPool, usdPool and set best path/adapters for token pairs", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);

            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor, owner]},
                {name: 'USDC', airdropList: []}
            ];

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

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
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should check onlyOwner methods", async () => {
            await expect(liquidationFlashloan.connect(depositor).transferERC20(ZERO, ZERO, 0)).to.be.revertedWith("Ownable: caller is not the owner");

            expect(await tokenContracts.get('AVAX')!.balanceOf(liquidationFlashloan.address)).to.be.equal(0);
            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: 1_000_000});
            await tokenContracts.get('AVAX')!.connect(owner).transfer(liquidationFlashloan.address, 1_000_000);
            expect(await tokenContracts.get('AVAX')!.balanceOf(liquidationFlashloan.address)).to.be.equal(1_000_000);

            let ownerUSDCBalance = await tokenContracts.get('AVAX')!.balanceOf(owner.address);
            await liquidationFlashloan.connect(owner).transferERC20(tokenContracts.get('AVAX')!.address, owner.address, 1_000_000);
            expect(await tokenContracts.get('AVAX')!.balanceOf(owner.address)).to.be.equal(ownerUSDCBalance.add(1_000_000));
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow and withdraw, making the loan's health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            const AVAX_PRICE = tokensPrices.get('AVAX')!;

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("700"),
                parseUnits((0.97 * 700 * AVAX_PRICE).toFixed(6), BigNumber.from("6")) //todo: .97
            );

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });

    describe('A loan with GLP', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            diamondCut: Contract,
            wrappedLoan: any,
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
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH', 'BTC', 'GLP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: []}
            ];

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

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
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "GLP"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow and mint GLP, making loan health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("150")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("150"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("150"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("850"));

            const minGlpAmount = Number(950 * tokensPrices.get("AVAX")! / tokensPrices.get("GLP")! * 98 / 100).toFixed();

            await wrappedLoan.mintAndStakeGlp(
                TOKEN_ADDRESSES['AVAX'],
                toWei("950"),
                0,
                toWei(minGlpAmount.toString()),
            )

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });

    describe('A loan with GLP staked in YieldYak', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            diamondCut: Contract,
            wrappedLoan: any,
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
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH', 'BTC', 'GLP', 'YY_GLP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: []}
            ];

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

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
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "GLP", "YY_GLP"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow, mint GLP and stake it in YY, making loan health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("150")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("150"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("150"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("850"));

            const minGlpAmount = Number(950 * tokensPrices.get("AVAX")! / tokensPrices.get("GLP")! * 98 / 100).toFixed();

            await wrappedLoan.mintAndStakeGlp(
                TOKEN_ADDRESSES['AVAX'],
                toWei("950"),
                0,
                toWei(minGlpAmount.toString()),
            )

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);

            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.gt(0);
            expect(fromWei(await tokenContracts.get("YY_GLP")!.balanceOf(wrappedLoan.address))).to.be.eq(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);

            await wrappedLoan.stakeGLPYak(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address));

            expect(fromWei(await tokenContracts.get("GLP")!.balanceOf(wrappedLoan.address))).to.be.eq(0);
            expect(fromWei(await tokenContracts.get("YY_GLP")!.balanceOf(wrappedLoan.address))).to.be.gt(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });


        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });

    describe('A loan with multiple swaps and debt in one token', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            diamondCut: Contract,
            wrappedLoan: any,
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
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH', 'BTC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: []}
            ];

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

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
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                 CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow and withdraw, making loan health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("150")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("150"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("150"));

            const AVAX_PRICE = tokensPrices.get('AVAX')!;
            const ETH_PRICE = tokensPrices.get('ETH')!;
            const BTC_PRICE = tokensPrices.get('BTC')!;

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("850"));

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("200"),
                parseUnits((0.9 * 200 * AVAX_PRICE).toFixed(6), BigNumber.from("6")) //todo: .97
            );

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('ETH'),
                toWei("500"),
                parseUnits((0.9 * 500 * AVAX_PRICE / ETH_PRICE).toFixed(18), BigNumber.from("18")) //todo: .97
            );

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('BTC'),
                toWei("300"),
                parseUnits((0.9 * 300 * AVAX_PRICE / BTC_PRICE).toFixed(8), BigNumber.from("8")) //todo: .97
            );

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });

    describe('A loan with debt and swaps in multiple tokens', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            diamondCut: Contract,
            wrappedLoan: any,
            tokenManager: any,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            ETH_PRICE: number,
            BTC_PRICE: number,
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
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH', 'BTC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: [borrower, depositor]}
            ];

            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            AVAX_PRICE = tokensPrices.get('AVAX')!;
            ETH_PRICE = tokensPrices.get('ETH')!;
            BTC_PRICE = tokensPrices.get('BTC')!;
            const wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);

            const usdcDeposited = parseUnits("4000", BigNumber.from("6"));
            const amountSwapped = toWei((4800 / AVAX_PRICE).toString());
            await wavaxToken.connect(depositor).deposit({value: amountSwapped});
            await wavaxToken.connect(depositor).approve(exchange.address, amountSwapped);
            await wavaxToken.connect(depositor).transfer(exchange.address, amountSwapped);

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await exchange.connect(depositor).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], amountSwapped, usdcDeposited);
            await tokenContracts.get("USDC")!.connect(depositor).approve(poolContracts.get("USDC")!.address, usdcDeposited);
            await poolContracts.get("USDC")!.connect(depositor).deposit(usdcDeposited);

            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

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
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                 CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow and withdraw, making loan's health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("400"));
            await wrappedLoan.borrow(toBytes32("USDC"), parseUnits("3000", BigNumber.from("6")));

            await wrappedLoan.swapTraderJoe(
                toBytes32('AVAX'),
                toBytes32('ETH'),
                toWei("200"),
                toWei((0.95 * 200 * AVAX_PRICE / ETH_PRICE).toString())
            );

            await wrappedLoan.swapTraderJoe(
                toBytes32('USDC'),
                toBytes32('BTC'),
                parseUnits("2800", BigNumber.from("6")),
                parseUnits((0.95 * 2800 / BTC_PRICE).toFixed(8), BigNumber.from("8"))
            );
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });

    describe('A loan with debt and swaps in multiple tokens', () => {
        let exchange: TraderJoeIntermediary,
            exchangePNG: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            diamondCut: Contract,
            wrappedLoan: any,
            tokenManager: any,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            ETH_PRICE: number,
            assetsList: Array<string> = [],
            BTC_PRICE: number,
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
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            assetsList = ['AVAX', 'USDC', 'sAVAX', 'ETH', 'BTC', 'YY_AAVE_AVAX', 'YY_PTP_sAVAX', 'TJ_AVAX_USDC_LP', 'YY_TJ_AVAX_USDC_LP','PNG_AVAX_ETH_LP'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: [borrower, depositor]}
            ];
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;
            exchangePNG = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            AVAX_PRICE = tokensPrices.get('AVAX')!;
            ETH_PRICE = tokensPrices.get('ETH')!;
            BTC_PRICE = tokensPrices.get('BTC')!;

            const wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);

            const usdcDeposited = parseUnits("4000", BigNumber.from("6"));
            const amountSwapped = toWei((4800 / AVAX_PRICE).toString());
            await wavaxToken.connect(depositor).deposit({value: amountSwapped});
            await wavaxToken.connect(depositor).approve(exchange.address, amountSwapped);
            await wavaxToken.connect(depositor).transfer(exchange.address, amountSwapped);

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await exchange.connect(depositor).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], amountSwapped, usdcDeposited);
            await tokenContracts.get("USDC")!.connect(depositor).approve(poolContracts.get("USDC")!.address, usdcDeposited);
            await poolContracts.get("USDC")!.connect(depositor).deposit(usdcDeposited);

            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                        contractAddress: exchange.address,
                    },
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchangePNG.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: assetsList,
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow and withdraw, making loan's health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("30")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("30"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei('30'));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei('170'))

            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("40"), toWei("0"));
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("ETH"), toWei("40"), toWei("0"));
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("sAVAX"), toWei("10"), toWei("0"));

            let usdcBalance = await wrappedLoan.getBalance(toBytes32('USDC'));
            let ethBalance = await wrappedLoan.getBalance(toBytes32('ETH'));

            await wrappedLoan.addLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), toWei("40"), usdcBalance, toWei("40").div(5).mul(4), usdcBalance.div(5).mul(4));
            await wrappedLoan.addLiquidityPangolin(toBytes32("AVAX"), toBytes32("ETH"), toWei("40"), ethBalance, toWei("40").div(5).mul(4), ethBalance.div(5).mul(4));
            await wrappedLoan.stakeAVAXYak(toWei('5'));
            await wrappedLoan.vectorStakeWAVAX1(toWei('5'));

            await wrappedLoan.stakeSAVAXYak((await tokenContracts.get('sAVAX')!.balanceOf(wrappedLoan.address)).div(2));

            await wrappedLoan.vectorStakeSAVAX1(await tokenContracts.get('sAVAX')!.balanceOf(wrappedLoan.address));
            await wrappedLoan.stakeTJAVAXUSDCYak((await wrappedLoan.getBalance(toBytes32('TJ_AVAX_USDC_LP'))).div(2));


            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });

    describe('A loan liquidated based on LTV', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            diamondCut: Contract,
            wrappedLoan: any,
            tokenManager: any,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            ETH_PRICE: number,
            BTC_PRICE: number,
            QI_PRICE: number,
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
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC', 'ETH', 'BTC', 'QI'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: [borrower, depositor]}
            ];
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            AVAX_PRICE = tokensPrices.get('AVAX')!;
            ETH_PRICE = tokensPrices.get('ETH')!;
            BTC_PRICE = tokensPrices.get('BTC')!;
            QI_PRICE = tokensPrices.get('QI')!;
            const wavaxToken = new ethers.Contract(TOKEN_ADDRESSES['AVAX'], wavaxAbi, provider);


            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            const usdcDeposited = parseUnits("4000", BigNumber.from("6"));
            const amountSwapped = toWei((4800 / AVAX_PRICE).toString());
            await wavaxToken.connect(depositor).deposit({value: amountSwapped});
            await wavaxToken.connect(depositor).approve(exchange.address, amountSwapped);
            await wavaxToken.connect(depositor).transfer(exchange.address, amountSwapped);

            await exchange.connect(depositor).swap(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC'], amountSwapped, usdcDeposited);
            await tokenContracts.get("USDC")!.connect(depositor).approve(poolContracts.get("USDC")!.address, usdcDeposited);
            await poolContracts.get("USDC")!.connect(depositor).deposit(usdcDeposited);

            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

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
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
            await deployAllFacets(diamondAddress, false);
            diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            // Deploy flash loan liquidation contract
            const LiquidationFlashloan = await ethers.getContractFactory('LiquidationFlashloan');

            liquidationFlashloan = await LiquidationFlashloan.deploy(
                aavePoolAddressesProviderAdress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc", "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xE091dFe40B8578FAF6FeC601686B4332Da5D43cc")).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc")).to.be.true;
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            // @ts-ignore
            wrappedLoan = WrapperBuilder.wrap(loan).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "QI"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                CACHE_LAYER_URLS.urls
            );
        });


        it("should fund, borrow and swap, making loan's LTV higher than 5", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("QI"), toWei("50"), 0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address, true);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});
