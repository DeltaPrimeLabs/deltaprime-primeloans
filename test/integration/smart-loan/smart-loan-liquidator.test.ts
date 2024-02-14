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
    toWei, ZERO
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {liquidateLoan} from '../../../tools/liquidation/liquidation-bot'
import {parseUnits} from "ethers/lib/utils";
import fs from "fs";
import path from "path";
import CACHE_LAYER_URLS from '../../../common/redstone-cache-layer-urls.json';

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "../../../tools/liquidation/.private")).toString().trim();
const rpcProvider = new ethers.providers.JsonRpcProvider()
const liquidatorWallet = (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(rpcProvider);

describe('Test liquidator', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('A loan with debt and repayment', () => {
        let exchange: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: Contract,
            wrappedLoan: any,
            wrappedLoan2: any,
            wrappedLoan3: any,
            wrappedLoan4: any,
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
            borrower2: SignerWithAddress,
            borrower3: SignerWithAddress,
            borrower4: SignerWithAddress,
            diamondAddress: any;


        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor, borrower, borrower2, borrower3, borrower4] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor, borrower2, borrower3, borrower4]},
                {name: 'USDC', airdropList: []}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList, "avalanche", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            //load liquidator wallet
            await tokenContracts.get('AVAX')!.connect(liquidatorWallet).deposit({value: toWei("5000")});

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

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
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
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
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();
        });

        function wrapLoan(loanContract: Contract, wallet=undefined){
            if(wallet){
                loanContract = loanContract.connect(wallet);
            }
            return WrapperBuilder.wrap(loanContract).usingDataService(
                {
                    dataServiceId: "redstone-avalanche-prod",
                    uniqueSignersCount: 3,
                    dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "LINK"],
                    // @ts-ignore
                    disablePayloadsDryRun: true
                },
                 CACHE_LAYER_URLS.urls
            );
        }


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();
            await smartLoansFactory.connect(borrower2).createLoan();
            await smartLoansFactory.connect(borrower3).createLoan();
            await smartLoansFactory.connect(borrower4).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);
            const loan_proxy_address2 = await smartLoansFactory.getLoanForOwner(borrower2.address);
            const loan_proxy_address3 = await smartLoansFactory.getLoanForOwner(borrower3.address);
            const loan_proxy_address4 = await smartLoansFactory.getLoanForOwner(borrower4.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);
            // @ts-ignore
            wrappedLoan = wrapLoan(loan);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address2, borrower2);
            // @ts-ignore
            wrappedLoan2 = wrapLoan(loan);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address3, borrower3);
            // @ts-ignore
            wrappedLoan3 = wrapLoan(loan);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address4, borrower4);
            // @ts-ignore
            wrappedLoan4 = wrapLoan(loan);
        });


        it("should fund, borrow and withdraw, making loan's health ratio lower than 1", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));

            await tokenContracts.get('AVAX')!.connect(borrower2).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower2).approve(wrappedLoan2.address, toWei("100"));
            await wrappedLoan2.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan2.borrow(toBytes32("AVAX"), toWei("600"));

            await tokenContracts.get('AVAX')!.connect(borrower3).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower3).approve(wrappedLoan3.address, toWei("100"));
            await wrappedLoan3.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan3.borrow(toBytes32("AVAX"), toWei("600"));

            await tokenContracts.get('AVAX')!.connect(borrower4).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower4).approve(wrappedLoan4.address, toWei("100"));
            await wrappedLoan4.fund(toBytes32("AVAX"), toWei("100"));
            await wrappedLoan4.borrow(toBytes32("AVAX"), toWei("501"));

            // await wrappedLoan.swapPangolin(
            //     toBytes32('AVAX'),
            //     toBytes32('USDC'),
            //     toWei("700"),
            //     parseUnits((0.97 * 700 * tokensPrices.get('AVAX')!).toFixed(6), BigNumber.from("6"))
            // );

            expect((fromWei(await wrappedLoan.getHealthRatio()))).to.be.lt(1);
            expect((fromWei(await wrappedLoan2.getHealthRatio()))).to.be.lt(1);
            expect((fromWei(await wrappedLoan3.getHealthRatio()))).to.be.lt(1);
            expect((fromWei(await wrappedLoan4.getHealthRatio()))).to.be.lt(1);
        });

        it("replace facet", async () => {
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('SolvencyFacetProdAvalanche', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            const TREASURY_ADDRESS = "0x764a9756994f4E6cd9358a6FcD924d566fC2e666";
            console.log(`HR: ${fromWei(await wrappedLoan.getHealthRatio())}`);
            console.log(`Debt: ${fromWei(await wrappedLoan.getDebt())}`);
            console.log(`TotalValue: ${fromWei(await wrappedLoan.getTotalValue())}`);
            console.log(`Liquidator address: ${liquidatorWallet.address}`);
            let whitelistingFacet = await ethers.getContractAt("ISmartLoanLiquidationFacet", diamondAddress, owner);
            await whitelistingFacet.whitelistLiquidators(["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]);
            //
            // await liquidateLoan(wrappedLoan.address, tokenManager.address);

            let wrappedLoanLiquidator = wrapLoan(wrappedLoan, liquidatorWallet);
            await expect(wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("100")], 101, 0)).to.be.revertedWith("Defined liquidation bonus higher than max. value");
            await expect(wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("100")], 0, 101)).to.be.revertedWith("Defined liquidation fees higher than max. value");
            await expect(wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("100")], 90, 10)).to.be.revertedWith("Fees not applicable");

            // Liquidation 1 - 10% bonus, 0% fees
            console.log('Liquidation 1');
            let liquidatorAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            let treasuryAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("300")], 100, 0);

            let liquidatorAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            let treasuryAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);
            expect(await wrappedLoan.isSolvent()).to.be.true;
            expect(liquidatorAVAXBalanceAfter).to.be.equal(liquidatorAVAXBalanceBefore.add(toWei("30")));
            expect(treasuryAVAXBalanceBefore).to.be.equal(treasuryAVAXBalanceAfter);

            // Liquidation 2 - 5% bonus, 0% fees
            console.log('Liquidation 2');
            wrappedLoanLiquidator = wrapLoan(wrappedLoan2, liquidatorWallet);
            liquidatorAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            treasuryAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("200")], 50, 0);

            liquidatorAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            treasuryAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);
            expect(await wrappedLoan.isSolvent()).to.be.true;
            expect(liquidatorAVAXBalanceAfter).to.be.equal(liquidatorAVAXBalanceBefore.add(toWei("10")));
            expect(treasuryAVAXBalanceBefore).to.be.equal(treasuryAVAXBalanceAfter);

            // Liquidation 3 - 10% bonus, 5% fees
            console.log('Liquidation 3');
            wrappedLoanLiquidator = wrapLoan(wrappedLoan3, liquidatorWallet);
            liquidatorAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            treasuryAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("500")], 100, 50);

            treasuryAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);
            liquidatorAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            expect(await wrappedLoan.isSolvent()).to.be.true;
            expect(liquidatorAVAXBalanceAfter).to.be.equal(liquidatorAVAXBalanceBefore.add(toWei("50")));
            expect(treasuryAVAXBalanceAfter).to.be.equal(treasuryAVAXBalanceBefore.add(toWei("25")));

            // Liquidation 4 - 10% bonus, 9% fees
            console.log('Liquidation 4');
            wrappedLoanLiquidator = wrapLoan(wrappedLoan4, liquidatorWallet);
            liquidatorAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            treasuryAVAXBalanceBefore = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);

            await wrappedLoanLiquidator.liquidateLoan([toBytes32("AVAX")], [toWei("100")], 100, 90);

            treasuryAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(TREASURY_ADDRESS);
            liquidatorAVAXBalanceAfter = await tokenContracts.get('AVAX')!.balanceOf(liquidatorWallet.address);
            expect(await wrappedLoan.isSolvent()).to.be.true;
            expect(fromWei(liquidatorAVAXBalanceAfter)).to.be.equal(fromWei(liquidatorAVAXBalanceBefore) + 10);
            expect(fromWei(treasuryAVAXBalanceAfter)).to.be.equal(fromWei(treasuryAVAXBalanceBefore) + 9);
        });
    });
});

