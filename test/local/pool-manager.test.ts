import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {PoolManager} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import PoolManagerArtifact from '../../artifacts/contracts/PoolManager.sol/PoolManager.json';
import {getFixedGasSigners, PoolAsset, toBytes32} from "../_helpers";
import {Contract} from "ethers";

const {deployContract} = waffle;
chai.use(solidity);

describe('Pool Manager tests', () => {
    let
        user: SignerWithAddress,
        owner: SignerWithAddress,
        poolManager: Contract;

    before(async() => {
        [user, owner] = await getFixedGasSigners(10000000);

        poolManager = await deployContract(
            owner,
            PoolManagerArtifact,
            [
                [],
                []
            ]
        ) as PoolManager;
    })

    it("should check that owner is the admin", async () => {
        expect(await poolManager.admin()).to.be.equal(owner.address);
    });

    it("should fail adding a Pool Asset to the PoolManager that is not a contract", async () => {
        await expect(poolManager.addPoolAssets([new PoolAsset(toBytes32("TEST1"), user.address)])).to.be.revertedWith("PoolManager: Pool must be a contract");
    });

    it("should fail to propose admin transfer as a non-admin", async () => {
        await expect(poolManager.connect(user).proposeAdminTransfer(user.address)).to.be.revertedWith("Admin only");
    });

    it("should propose admin transfer as an admin", async () => {
        await poolManager.connect(owner).proposeAdminTransfer(user.address);
        expect(await poolManager.adminTransferProposal()).to.be.equal(user.address);
    });

    it("should fail to execute an admin transfer proposal as a non-new-admin", async () => {
        await expect(poolManager.connect(owner).executeAdminTransfer()).to.be.revertedWith("Only the proposed new admin can execute admin transfer proposal");
    });

    it("should execute an admin transfer proposal a the new-admin", async () => {
        await poolManager.connect(user).executeAdminTransfer();
        expect(await poolManager.admin()).to.be.equal(user.address);
        expect(await poolManager.adminTransferProposal()).to.be.equal(ethers.constants.AddressZero);
    });

    it("should fail to execute an admin transfer proposal without an active proposal", async () => {
        await expect(poolManager.connect(owner).executeAdminTransfer()).to.be.revertedWith("There is no active admin transfer proposal");
    });
});