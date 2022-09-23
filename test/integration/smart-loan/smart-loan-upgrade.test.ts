import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    fromWei,
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
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager
} from "../../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');
const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

describe('Smart loan - upgrading', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Check basic logic before and after upgrade', () => {
        let exchange: PangolinIntermediary,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            smartLoansFactory: SmartLoansFactory,
            owner: SignerWithAddress,
            other: SignerWithAddress,
            oracle: SignerWithAddress,
            tokenManager: any,
            borrower: SignerWithAddress,
            depositor: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("should deploy provider, exchange, loansFactory and WrappedNativeTokenPool", async () => {
            [owner, oracle, depositor, borrower, other] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'USDC'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]}
            ];
            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));
            await deployPools(poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)

            tokensPrices = await getTokensPricesMap(assetsList, getRedstonePrices);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            tokenManager = await deployContract(
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

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
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
            await deployAllFacets(diamondAddress)
        });

        it("should create a loan", async () => {
            const wrappedSmartLoansFactory = WrapperBuilder
                .mockLite(smartLoansFactory.connect(borrower))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    });

            await wrappedSmartLoansFactory.createLoan();

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
                    })


        });


        it("should check if only one loan per owner is allowed", async () => {
            await expect(smartLoansFactory.connect(borrower).createLoan()).to.be.revertedWith("Only one loan per owner is allowed");
            await expect(smartLoansFactory.connect(borrower).createAndFundLoan(toBytes32("AVAX"), TOKEN_ADDRESSES['AVAX'], 0)).to.be.revertedWith("Only one loan per owner is allowed");
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);

            await tokenContracts.get('AVAX')!.connect(borrower).deposit({value: toWei("2")});
            await tokenContracts.get('AVAX')!.connect(borrower).approve(wrappedLoan.address, toWei("2"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("2"));

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(2 * tokensPrices.get('AVAX')!, 0.1);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);
        });

        it("should not allow to re-initialize", async () => {
            await expect(wrappedLoan.initialize(owner.address)).to.be.revertedWith('DiamondInit: contract is already initialized');
        });

        it("should not allow to upgrade from non-owner", async () => {
            const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress, borrower);
            await expect(diamondCut.diamondCut([], ethers.constants.AddressZero, [])).to.be.revertedWith('DiamondStorageLib: Must be contract owner');
        });


        it("should upgrade", async () => {
            await replaceFacet("MockSolvencyFacetConstantDebt", diamondAddress, ['getDebt'])

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
                    })

            //The mock loan has a hardcoded debt of 2137
            expect(await wrappedLoan.getDebt()).to.be.equal(2137);
        });
    });
});
