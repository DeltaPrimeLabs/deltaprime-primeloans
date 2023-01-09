import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, fromBytes32, fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei, ZERO
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    TraderJoeIntermediary,
    SmartLoansFactory,
    LiquidationFlashloan, MockTokenManager
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {liquidateLoan} from '../../../tools/liquidation/liquidation-bot-flashloan';
import redstone from "redstone-api";
import {parseUnits} from "ethers/lib/utils";
import fs from "fs";
import path from "path";
import CACHE_LAYER_URLS from '../../../common/redstone-cache-layer-urls.json';
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';
const wavaxTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const aavePoolAddressesProviderAdress = '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb';


const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "../../../tools/liquidation/.private")).toString().trim();
const rpcProvider = new ethers.providers.JsonRpcProvider()
const liquidatorWallet = (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(rpcProvider);

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function transfer(address _to, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

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


        before("deploy factory, exchange, wavaxPool and usdPool", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);

            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: []}
            ];

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
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

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            await smartLoansFactory.initialize(diamondAddress);

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
                traderJoeRouterAddress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should check onlyOwner methods", async () => {
            await expect(liquidationFlashloan.connect(depositor).transferERC20(ZERO, ZERO, 0)).to.be.revertedWith("Ownable: caller is not the owner");

            expect(await tokenContracts.get('USDC')!.balanceOf(liquidationFlashloan.address)).to.be.equal(0);
            await tokenContracts.get('USDC')!.connect(owner).transfer(1_000_000, liquidationFlashloan.address);
            expect(await tokenContracts.get('USDC')!.balanceOf(liquidationFlashloan.address)).to.be.equal(1_000_000);

            let ownerUSDCBalance = await tokenContracts.get('USDC')!.balanceOf(owner.address);
            await liquidationFlashloan.connect(owner).transferERC20(tokenContracts.get('USDC')!.address, owner.address, 1_000_000);
            expect(await tokenContracts.get('USDC')!.balanceOf(owner.address)).to.be.equal(ownerUSDCBalance + 1_000_000);
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6")).to.be.true;
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

            const AVAX_PRICE = (await redstone.getPrice('AVAX')).value;

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
            await replaceFacet('SolvencyFacetProd', diamondAddress, ['isSolvent']);
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
            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
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

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, tokenManager.address, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;

            await smartLoansFactory.initialize(diamondAddress);

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
                traderJoeRouterAddress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6")).to.be.true;
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

            const AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            const ETH_PRICE = (await redstone.getPrice('ETH')).value;
            const BTC_PRICE = (await redstone.getPrice('BTC')).value;

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
            await replaceFacet('SolvencyFacetProd', diamondAddress, ['isSolvent']);
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

            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            ETH_PRICE = (await redstone.getPrice('ETH')).value;
            BTC_PRICE = (await redstone.getPrice('BTC')).value;
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

            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);
            await smartLoansFactory.initialize(diamondAddress);

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
                traderJoeRouterAddress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6")).to.be.true;
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
            await replaceFacet('SolvencyFacetProd', diamondAddress, ['isSolvent']);
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

            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            ETH_PRICE = (await redstone.getPrice('ETH')).value;
            BTC_PRICE = (await redstone.getPrice('BTC')).value;
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

            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress);

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
                traderJoeRouterAddress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6")).to.be.true;
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

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("550"));

            await wrappedLoan.vectorStakeWAVAX1(toWei("550"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProd', diamondAddress, ['isSolvent']);
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

            AVAX_PRICE = (await redstone.getPrice('AVAX')).value;
            ETH_PRICE = (await redstone.getPrice('ETH')).value;
            BTC_PRICE = (await redstone.getPrice('BTC')).value;
            QI_PRICE = (await redstone.getPrice('QI')).value;
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

            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("1000")});

            diamondAddress = await deployDiamond();

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );

            await smartLoansFactory.initialize(diamondAddress);

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
                traderJoeRouterAddress,
                wavaxTokenAddress,
                diamondAddress
            ) as LiquidationFlashloan;
        });

        it("should whitelist LIQUIDATOR and flashloan contract", async () => {
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators([liquidationFlashloan.address, "0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6"]);
            expect(await whitelistingFacet.isLiquidatorWhitelisted(liquidationFlashloan.address)).to.be.true;
            expect(await whitelistingFacet.isLiquidatorWhitelisted("0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6")).to.be.true;
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

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("500"));
            await wrappedLoan.swapTraderJoe(toBytes32("AVAX"), toBytes32("QI"), toWei("50"), 0);

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.lt(1);
        });

        it("replace facet", async () => {
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProd', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, liquidationFlashloan.address, tokenManager.address, true);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

