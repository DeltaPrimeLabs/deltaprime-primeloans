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
    PangolinIntermediary,
    RedstoneConfigManager__factory,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {liquidateLoan} from '../../../tools/liquidation/liquidation-bot'
import {parseUnits} from "ethers/lib/utils";
import fs from "fs";
import path from "path";

const {deployDiamond, deployFacet, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
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
            diamondAddress: any;


        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor, borrower] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [borrower, depositor]},
                {name: 'USDC', airdropList: []}
            ];

            redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(
                    [
                        "0xFE71e9691B9524BC932C23d0EeD5c9CE41161884",
                        "0x1cd8f9627a2838a7dae6b98cf71c08b9cbf5174a",
                        "0x981bda8276ae93f567922497153de7a5683708d3",
                        "0x3befdd935b50f172e696a5187dbacfef0d208e48",
                        "0xc1d5b940659e57b7bdf8870cdfc43f41ca699460",
                        "0xbc5a06815ee80de7d20071703c1f1b8fc511c7d4",
                        "0x496f4e8ac11076350a59b88d2ad62bc20d410ea3",
                        "0xe9fa2869c5f6fc3a0933981825564fd90573a86d",
                        "0xdf6b1ca313bee470d0142279791fa760abf5c537",
                    ])
            );

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
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
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();
        });


        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    });
        });


        it("should fund, borrow and withdraw, making loan LTV higher than 500%", async () => {
            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("100")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("100"));

            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("600"));

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("700"),
                parseUnits((0.97 * 700 * tokensPrices.get('AVAX')!).toFixed(6), BigNumber.from("6"))
            );

            expect((await wrappedLoan.getLTV()).toNumber()).to.be.gt(5000);
        });

        it("replace facet", async () => {
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, owner);
            await diamondCut.pause();
            await replaceFacet('SolvencyFacet', diamondAddress, ['isSolvent']);
            await diamondCut.unpause();

            expect(await wrappedLoan.isSolvent()).to.be.false;
        });

        it("liquidate loan", async () => {
            await liquidateLoan(wrappedLoan.address, tokenManager.address);

            expect(await wrappedLoan.isSolvent()).to.be.true;
        });
    });
});

