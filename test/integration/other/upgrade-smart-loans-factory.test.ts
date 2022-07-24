import {Asset, deployAndInitPangolinExchangeContract, syncTime, toBytes32} from "../../_helpers";
import {
    MockUpgradedSmartLoansFactory,
    MockUpgradedSmartLoansFactory__factory,
    PangolinExchange,
    Pool,
    SmartLoansFactory,
    SmartLoansFactory__factory,
    TransparentUpgradeableProxy,
    TransparentUpgradeableProxy__factory,
} from "../../../typechain";
import MockSmartLoansFactoryArtifact from '../../../artifacts/contracts/mock/MockUpgradedSmartLoansFactory.sol/MockUpgradedSmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import chai, {expect} from "chai";
import {deployContract, solidity} from "ethereum-waffle";
import {ethers} from "hardhat";
import {getFixedGasSigners} from "../../_helpers";
import TOKEN_ADDRESSES from '../../../common/token_addresses.json';


chai.use(solidity);

const {deployDiamond, deployFacet} = require('../../../tools/diamond/deploy-diamond');
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loans factory - upgrading',  () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('Check basic logic before and after upgrade', () => {
        let smartLoansFactory: SmartLoansFactory,
            pool: Pool,
            exchange: PangolinExchange,
            owner: SignerWithAddress,
            admin: SignerWithAddress,
            proxy: TransparentUpgradeableProxy,
            ownerLoanAddress: any;
        before("should deploy provider, exchange, loansFactory and pool", async () => {
            let diamondAddress = await deployDiamond();
            [owner, admin] = await getFixedGasSigners(10000000);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;
            exchange = await deployAndInitPangolinExchangeContract(owner, pangolinRouterAddress, [new Asset(toBytes32('USD'), TOKEN_ADDRESSES['USDT'])]);
            smartLoansFactory = await (new SmartLoansFactory__factory(owner).deploy());

            proxy = await (new TransparentUpgradeableProxy__factory(owner).deploy(smartLoansFactory.address, admin.address, []));
            smartLoansFactory = await (new SmartLoansFactory__factory(owner).attach(proxy.address));

            await deployFacet("MockSmartLoanLogicFacetRedstoneProvider", diamondAddress, []);

            await smartLoansFactory.connect(owner).initialize(diamondAddress);

            await smartLoansFactory.createLoan();
            ownerLoanAddress = await smartLoansFactory.getLoanForOwner(owner.address);
        });

        it("should not allow to upgrade from non-admin", async () => {
            const smartLoansFactoryV2 = await (new MockUpgradedSmartLoansFactory__factory(owner).deploy());

            //TODO: sometimes reverts with a wrong revert message
            await expect(proxy.connect(owner).upgradeTo(smartLoansFactoryV2.address))
                .to.be.reverted;
        });


        it("should upgrade", async () => {
            const smartLoansFactoryV2 = await (new MockUpgradedSmartLoansFactory__factory(owner).deploy());

            await proxy.connect(admin).upgradeTo(smartLoansFactoryV2.address);

            let smartLoansFactoryUpgraded = (await new ethers.Contract(smartLoansFactory.address, MockSmartLoansFactoryArtifact.abi)) as MockUpgradedSmartLoansFactory;

            //The mock exchange has a hardcoded return value of 1337
            expect(await smartLoansFactoryUpgraded.connect(owner).newMockedFunction()).to.be.equal(1337);
            // The contract's borrowers registry should stay unchanged
            expect(ownerLoanAddress).to.be.equal(await smartLoansFactory.getLoanForOwner(owner.address));
        });
    });
});