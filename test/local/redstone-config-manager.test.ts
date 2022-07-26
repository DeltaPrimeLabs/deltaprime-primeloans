import chai, {expect} from 'chai'
import {ethers} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {
    RedstoneConfigManager,
    RedstoneConfigManager__factory,
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners} from "../_helpers";
import {sign} from "crypto";
chai.use(solidity);

describe('Redstone config manager', () => {
    let redstoneConfigManagerContract: RedstoneConfigManager,
        owner: SignerWithAddress,
        other: SignerWithAddress,
        signer1: SignerWithAddress,
        signer2: SignerWithAddress,
        signer3: SignerWithAddress,
        signer4: SignerWithAddress;

    before(async() => {
        [owner, other, signer1, signer2, signer3, signer4] = await getFixedGasSigners(10000000);
        redstoneConfigManagerContract = await (new RedstoneConfigManager__factory(owner).deploy([signer1.address, signer2.address], 777));
    })

    it("should check if the values set during deployment were properly saved in contract's storage", async () => {
        let maxBlockTimestampDelay = await redstoneConfigManagerContract.maxBlockTimestampDelay();
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(maxBlockTimestampDelay).to.be.equal(777);
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address]);
        expect(trustedSigners.length).to.be.equal(2);
    });

    it("should fail to set maxBlockTimestampDelay as a non-owner", async () => {
        await expect(redstoneConfigManagerContract.connect(other).setMaxBlockTimestampDelay(1337)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set a new maxBlockTimestampDelay as an owner", async () => {
        let maxBlockTimestampDelay = await redstoneConfigManagerContract.maxBlockTimestampDelay();
        expect(maxBlockTimestampDelay).to.be.equal(777);
        await redstoneConfigManagerContract.connect(owner).setMaxBlockTimestampDelay(1337);
        maxBlockTimestampDelay = await redstoneConfigManagerContract.maxBlockTimestampDelay();
        expect(maxBlockTimestampDelay).to.be.equal(1337);
    });

    it("should fail to add a new trusted signer as a non-owner", async () => {
        await expect(redstoneConfigManagerContract.connect(other).addTrustedSigners([signer3.address])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should add a new trusted signer as an owner", async () => {
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address]);
        expect(trustedSigners.length).to.be.equal(2);
        await redstoneConfigManagerContract.addTrustedSigners([signer3.address]);
        trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address, signer3.address]);
        expect(trustedSigners.length).to.be.equal(3);
    });

    it("should fail to add an already existing trusted signer as an owner", async () => {
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address, signer3.address]);
        expect(trustedSigners.length).to.be.equal(3);
        await expect(redstoneConfigManagerContract.addTrustedSigners([signer2.address])).to.be.revertedWith("Signer already exists");
    });

    it("should fail to remove a trusted signer as a non-owner", async () => {
        await expect(redstoneConfigManagerContract.connect(other).removeTrustedSigners([signer3.address])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should remove a trusted signer as an owner", async () => {
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address, signer3.address]);
        expect(trustedSigners.length).to.be.equal(3);
        await redstoneConfigManagerContract.removeTrustedSigners([signer3.address]);
        trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address]);
        expect(trustedSigners.length).to.be.equal(2);
    });

    it("should remove a trusted signer from the beginning of an array as an owner", async () => {
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer1.address, signer2.address]);
        expect(trustedSigners.length).to.be.equal(2);
        await redstoneConfigManagerContract.removeTrustedSigners([signer1.address]);
        trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer2.address]);
        expect(trustedSigners.length).to.be.equal(1);
    });

    it("should add multiple new trusted signers as an owner", async () => {
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer2.address]);
        expect(trustedSigners.length).to.be.equal(1);
        await redstoneConfigManagerContract.addTrustedSigners([signer3.address, signer4.address]);
        trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer2.address, signer3.address, signer4.address]);
        expect(trustedSigners.length).to.be.equal(3);
    });

    it("should remove multiple trusted signers from the beginning of an array as an owner", async () => {
        let trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer2.address, signer3.address, signer4.address]);
        expect(trustedSigners.length).to.be.equal(3);
        await redstoneConfigManagerContract.removeTrustedSigners([signer2.address, signer3.address]);
        trustedSigners = await redstoneConfigManagerContract.getTrustedSigners();
        expect(trustedSigners).to.have.all.members([signer4.address]);
        expect(trustedSigners.length).to.be.equal(1);
    });

});