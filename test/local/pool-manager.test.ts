import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {TokenManager} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TokenManagerArtifact from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import {getFixedGasSigners, PoolAsset, toBytes32} from "../_helpers";
import {Contract} from "ethers";

const {deployContract} = waffle;
chai.use(solidity);

describe('Pool Manager tests', () => {
    let
        user: SignerWithAddress,
        owner: SignerWithAddress,
        tokenManager: Contract;

    before(async () => {
        [user, owner] = await getFixedGasSigners(10000000);

        tokenManager = await deployContract(
            owner,
            TokenManagerArtifact,
            [
                [],
                []
            ]
        ) as TokenManager;
    })

    it("should check that owner is the admin", async () => {
        expect(await tokenManager.admin()).to.be.equal(owner.address);
    });

    it("should fail adding a Pool Asset to the TokenManager that is not a contract", async () => {
        await expect(tokenManager.addPoolAssets([new PoolAsset(toBytes32("TEST1"), user.address)])).to.be.revertedWith("TokenManager: Pool must be a contract");
    });

    it("should fail to propose admin transfer as a non-admin", async () => {
        await expect(tokenManager.connect(user).proposeAdminTransfer(user.address)).to.be.revertedWith("Admin only");
    });

    it("should propose admin transfer as an admin", async () => {
        await tokenManager.connect(owner).proposeAdminTransfer(user.address);
        expect(await tokenManager.adminTransferProposal()).to.be.equal(user.address);
    });

    it("should fail to execute an admin transfer proposal as a non-new-admin", async () => {
        await expect(tokenManager.connect(owner).executeAdminTransfer()).to.be.revertedWith("Only the proposed new admin can execute admin transfer proposal");
    });

    it("should execute an admin transfer proposal a the new-admin", async () => {
        await tokenManager.connect(user).executeAdminTransfer();
        expect(await tokenManager.admin()).to.be.equal(user.address);
        expect(await tokenManager.adminTransferProposal()).to.be.equal(ethers.constants.AddressZero);
    });

    it("should fail to execute an admin transfer proposal without an active proposal", async () => {
        await expect(tokenManager.connect(owner).executeAdminTransfer()).to.be.revertedWith("There is no active admin transfer proposal");
    });
});