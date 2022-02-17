import chai, {expect} from 'chai'
import {ethers} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {
    MockBorrowAccessNFT,
    MockBorrowAccessNFT__factory,
    MockNFTAccess,
    MockNFTAccess__factory, OpenBorrowersRegistry,
    OpenBorrowersRegistry__factory
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners} from "../_helpers";
chai.use(solidity);

describe('NFT Access test', () => {
    let accessContract: MockNFTAccess,
        nftContract: MockBorrowAccessNFT,
        nonERC721Contract: OpenBorrowersRegistry,
        owner: SignerWithAddress,
        other: SignerWithAddress;

    before(async() => {
        [owner, other] = await getFixedGasSigners(10000000);
        nftContract = await (new MockBorrowAccessNFT__factory(owner).deploy());
        nonERC721Contract = await (new OpenBorrowersRegistry__factory(owner).deploy());
        accessContract = (await (new MockNFTAccess__factory(owner).deploy())).connect(owner);
        await accessContract.initialize();
    })

    it("should fail to set accessNFT as a non-owner", async () => {
        await expect(accessContract.connect(other).setAccessNFT(nftContract.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should fail to set accessNFT to a non-contract address", async () => {
        await expect(accessContract.setAccessNFT(owner.address)).to.be.revertedWith("Cannot set nftAddress to a non-contract instance");
    });

    it("should fail to set accessNFT to a contract that does not support ERC721 balanceOf() interface", async () => {
        await expect(accessContract.setAccessNFT(nonERC721Contract.address)).to.be.revertedWith("Contract has to support the ERC721 balanceOf() interface");
    });

    it("should not require access NFT to access a function with NFT lock modifier", async () => {
        expect(await accessContract.connect(other).nftAccessFunction()).to.be.equal(777);
    });

    it("should set accessNFT to a contract address as the owner", async () => {
        await accessContract.connect(owner).setAccessNFT(nftContract.address);
    });

    it("should require access NFT to access a function with NFT lock modifier", async () => {
        await expect(accessContract.connect(other).nftAccessFunction()).to.be.revertedWith("Access NFT required");
    });

    it("should access mock function after minting an NFT", async () => {
        await nftContract.connect(owner).addAvailableUri(["uri_1"]);
        await nftContract.connect(other).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");
        expect(await accessContract.connect(other).nftAccessFunction()).to.be.equal(777);
    });

    it("should get previously set nftAccess address as a non-owner", async () => {
        accessContract.connect(other);
        const nftAddress = await accessContract.getAccessNFT();
        expect(nftAddress).to.be.equal(nftContract.address);
    });

    it("should set the NFT access address to 0 and remove the lock from mock function", async () => {
        await expect(accessContract.connect(owner).nftAccessFunction()).to.be.revertedWith("Access NFT required");
        await accessContract.connect(owner).setAccessNFT(ethers.constants.AddressZero);
        expect(await accessContract.connect(owner).nftAccessFunction()).to.be.equal(777);
    });
});