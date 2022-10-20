import chai, {expect} from 'chai'
import {deployContract, solidity} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import {
    addMissingTokenContracts,
    Asset, convertAssetsListToSupportedAssets, convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitializeLendingPool, deployPools, fromWei,
    getFixedGasSigners, getRedstonePrices, getTokensPricesMap,
    PoolAsset, PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {
    RedstoneConfigManager__factory,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {ethers} from "hardhat";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import {WrapperBuilder} from "redstone-evm-connector";
import {Contract} from "ethers";

chai.use(solidity);


describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });


    describe('A loan with edge LTV cases', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory, exchange, wrapped native token pool and USD pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'MCKUSD', 'ETH'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
                {name: 'MCKUSD', airdropList: [owner, depositor]}
            ];

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(assetsList.filter(el => el !== 'MCKUSD'), getRedstonePrices, [{symbol: 'MCKUSD', value: 1}]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, {MCKUSD: tokenContracts.get('MCKUSD')!.address});
            addMissingTokenContracts(tokenContracts, assetsList);

            let tokenManager = await deployContract(
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
                smartLoansFactory.address,
                'lib',
                5020
            );

            await deployAllFacets(diamondAddress);
            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();

            const loanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, owner);

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

        it("should check debt equal to 0", async () => {
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1);
            expect(await wrappedLoan.isSolvent()).to.be.true;

            await tokenContracts.get('MCKUSD')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("MCKUSD"), toWei("100"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1);
        });

        it("should check debt greater than 0 and lesser than totalValue", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("25"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(4.1666667, 0.000001);
        });

        it("should check health ratio 4999", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("474"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(1.000334, 0.000001);
        });

        it("should check LTV 5000", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("1"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(1, 0.00001);
        });

        it("should check LTV 5010", async () => {
            await wrappedLoan.borrow(toBytes32("MCKUSD"), toWei("1"));

            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(0.999667, 0.000001);
        });
    });
});

