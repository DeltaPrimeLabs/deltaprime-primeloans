import chai, {expect} from 'chai'
import {ethers, waffle} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {TokenManager} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TokenManagerArtifact from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import {fromBytes32, getFixedGasSigners, PoolAsset, Asset, toBytes32, toWei, fromWei} from "../_helpers";
import {Contract} from "ethers";
const addresses = require("../../common/addresses/avax/token_addresses.json");

const {deployContract} = waffle;
chai.use(solidity);

describe('Token Manager tests', () => {
    let
        admin: SignerWithAddress,
        nonAdmin: SignerWithAddress,
        owner: SignerWithAddress,
        tokenManager: Contract;

    before(async () => {
        [admin, owner, nonAdmin] = await getFixedGasSigners(10000000);

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
        await expect(tokenManager.addPoolAssets([new PoolAsset(toBytes32("TEST1"), admin.address)])).to.be.revertedWith("TokenManager: Pool must be a contract");
    });

    it("should fail to propose admin transfer as a non-admin", async () => {
        await expect(tokenManager.connect(admin).proposeAdminTransfer(admin.address)).to.be.revertedWith("Admin only");
    });

    it("should propose admin transfer as an admin", async () => {
        await tokenManager.connect(owner).proposeAdminTransfer(admin.address);
        expect(await tokenManager.adminTransferProposal()).to.be.equal(admin.address);
    });

    it("should fail to execute an admin transfer proposal as a non-new-admin", async () => {
        await expect(tokenManager.connect(owner).executeAdminTransfer()).to.be.revertedWith("Only the proposed new admin can execute admin transfer proposal");
    });

    it("should execute an admin transfer proposal a the new-admin", async () => {
        await tokenManager.connect(admin).executeAdminTransfer();
        expect(await tokenManager.admin()).to.be.equal(admin.address);
        expect(await tokenManager.adminTransferProposal()).to.be.equal(ethers.constants.AddressZero);
    });

    it("should fail to execute an admin transfer proposal without an active proposal", async () => {
        await expect(tokenManager.connect(owner).executeAdminTransfer()).to.be.revertedWith("There is no active admin transfer proposal");
    });

    it("should add pool assets", async () => {
        let newAssets = [
            new PoolAsset(toBytes32("AVAX"), addresses.AVAX),
            new PoolAsset(toBytes32("BTC"), addresses.BTC)
        ];
        await tokenManager.connect(admin).addPoolAssets(newAssets);
        let poolAssets = await tokenManager.getAllPoolAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("AVAX"), toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.BTC))).to.be.equal("");
    });

    it("should fail to add an already existing asset", async () => {
        let newAssets = [
            new PoolAsset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await expect(tokenManager.connect(admin).addPoolAssets(newAssets)).to.be.revertedWith("Asset's pool already exists");
    });

    it("should remove pool asset", async () => {
        let assetsToRemove = [
            toBytes32("AVAX")
        ];
        await tokenManager.connect(admin).removePoolAssets(assetsToRemove);
        let poolAssets = await tokenManager.getAllPoolAssets();
        expect(poolAssets.length).to.be.equal(1);
        expect(poolAssets).to.be.eql([toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.BTC))).to.be.equal("");
    });

    it("should add pool asset back", async () => {
        let newAssets = [
            new PoolAsset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await tokenManager.connect(admin).addPoolAssets(newAssets);
        let poolAssets = await tokenManager.getAllPoolAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("BTC"), toBytes32("AVAX")]);
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.BTC))).to.be.equal("");
    });

    it("should add token assets", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX"), addresses.AVAX),
            new Asset(toBytes32("BTC"), addresses.BTC)
        ];
        await tokenManager.connect(admin).addTokenAssets(newAssets);
        let poolAssets = await tokenManager.getAllTokenAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("AVAX"), toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("AVAX");
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.BTC))).to.be.equal("BTC");
    });

    it("should fail to add an already existing asset", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await expect(tokenManager.connect(admin).addTokenAssets(newAssets)).to.be.revertedWith("Asset's token already exists");
    });

    it("should remove token asset", async () => {
        let assetsToRemove = [
            toBytes32("AVAX")
        ];
        await tokenManager.connect(admin).removeTokenAssets(assetsToRemove);
        let poolAssets = await tokenManager.getAllTokenAssets();
        expect(poolAssets.length).to.be.equal(1);
        expect(poolAssets).to.be.eql([toBytes32("BTC")]);
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("");
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.BTC))).to.be.equal("BTC");
    });

    it("should add token asset back", async () => {
        let newAssets = [
            new Asset(toBytes32("AVAX"), addresses.AVAX)
        ];
        await tokenManager.connect(admin).addTokenAssets(newAssets);
        let poolAssets = await tokenManager.getAllTokenAssets();
        expect(poolAssets.length).to.be.equal(2);
        expect(poolAssets).to.be.eql([toBytes32("BTC"), toBytes32("AVAX")]);
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.AVAX))).to.be.equal("AVAX");
        expect(fromBytes32(await tokenManager.connect(admin).tokenAddressToSymbol(addresses.BTC))).to.be.equal("BTC");
    });

    it("should change token leverage", async () => {
        expect(fromWei(await tokenManager.connect(admin).maxTokenLeverage(addresses.AVAX))).to.be.equal(0.8333333333333333);
        await tokenManager.connect(admin).setMaxTokenLeverage(addresses.AVAX, toWei("0.5"));
        expect(fromWei(await tokenManager.connect(admin).maxTokenLeverage(addresses.AVAX))).to.be.equal(0.5);
    });

    it("should not accept leverage higher than x5", async () => {
        await expect(tokenManager.connect(admin).setMaxTokenLeverage(addresses.AVAX, toWei("0.8333333333333334"))).to.be.revertedWith("Leverage higher than maximum acceptable");
    });

    it("should not accept leverage lower than 0", async () => {
        await expect(tokenManager.connect(admin).setMaxTokenLeverage(addresses.AVAX, toWei("-0.1"))).to.be.reverted;
    });

    it("should not accept leverage change by a non-admin", async () => {
        await expect(tokenManager.connect(nonAdmin).setMaxTokenLeverage(addresses.AVAX, toWei("0.6"))).to.be.revertedWith("Admin only");
    });
});