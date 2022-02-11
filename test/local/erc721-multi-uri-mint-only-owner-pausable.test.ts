import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import BorrowAccessNFTArtifact from '../../artifacts/contracts/ERC721/BorrowAccessNFT.sol/BorrowAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners, toBytes32} from "../_helpers";
import {BorrowAccessNFT} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('ERC721 with multi URI, owner-only minting and pausability', () => {
    let owner: SignerWithAddress,
        user: SignerWithAddress,
        user2: SignerWithAddress,
        nftContract: Contract;

    before(async () => {
        [owner, user, user2] = await getFixedGasSigners(10000000);
        nftContract = (await deployContract(owner, BorrowAccessNFTArtifact)) as BorrowAccessNFT;
    });

    it("should fail to add new available uris as a non-owner", async () => {
        await expect(nftContract.connect(user).addAvailableUri(["uri_1", "uri_2", "uri_3"])).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should add new available uris as an owner", async () => {
        await nftContract.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
    });

    it("should fail to mint an NFT token with an invalid signature", async () => {
        await expect(nftContract.connect(user).safeMint("123456", "0x03eda92dd1684ecfde8c5cefceb75326aad40977430849161bee9627cafa5bb43911440abe7977f3354b25ef3a1058e1332a0b414abcaf7ef960ebab37fb6a671c")).to.be.revertedWith("Signer not authorized");
    });

    it("should mint 3 NFT tokens with different URIs using different accounts", async () => {
        await nftContract.connect(owner).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");
        await nftContract.connect(user).safeMint("700052663748001973", "0x03eda92dd1684ecfde8c5cefceb75326aad40977430849161bee9627cafa5bb43911440abe7977f3354b25ef3a1058e1332a0b414abcaf7ef960ebab37fb6a671c");

        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(0)).to.be.equal("uri_2");
        expect(await nftContract.tokenURI(1)).to.be.equal("uri_1");
        await expect(nftContract.tokenURI(2)).to.be.revertedWith("ERC721URIStorage: URI query for nonexistent token");
    });

    it("should fail to mint an NFT token for a user that has already minted one", async () => {
        await expect(nftContract.connect(user).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b")).to.be.revertedWith("Only one NFT per one user is allowed");
    });

    it("should fail to mint an NFT token because of lack of available uris", async () => {
        await expect(nftContract.connect(user2).safeMint("874568844935561227", "0xaf000c20a538dcd1e68ab4582a46c12e9ef50291eb6d83521314b24f21b3c91263bac46788640854938367e311139c4ca8d5ec29cf3332f3ef8f98b96c2d2cd81b")).to.be.revertedWith("All available NFTs were already minted");
    });

    it("should unpause contract", async () => {
        await expect(nftContract.connect(user).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
        await nftContract.connect(owner).unpause()
        expect(await nftContract.connect(owner).paused()).to.be.false;
        await expect(nftContract.connect(owner).unpause()).to.be.revertedWith("Pausable: not paused")
    });

    it("should allow transferring tokens from and to all users", async () => {
        await nftContract.connect(owner)["safeTransferFrom(address,address,uint256)"](owner.address, user.address, 0);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(0);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(2);

        await nftContract.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, owner.address, 0);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
    });

    it("should pause contract", async () => {
        await expect(nftContract.connect(user).pause()).to.be.revertedWith("Ownable: caller is not the owner");
        await nftContract.connect(owner).pause()
        expect(await nftContract.connect(owner).paused()).to.be.true;
        await expect(nftContract.connect(owner).pause()).to.be.revertedWith("Pausable: paused")
    });

    it("should not allow to transfer", async () => {
        await expect(nftContract.connect(owner)["safeTransferFrom(address,address,uint256)"](owner.address, user.address, 0)).to.be.revertedWith("Pausable: paused");
    });

    it("should add a new available uri as an owner and mint an additional NFT for user2 despite the pause", async () => {
        await nftContract.connect(owner).addAvailableUri(["uri_3"]);
        await nftContract.connect(user2).safeMint("874568844935561227", "0xaf000c20a538dcd1e68ab4582a46c12e9ef50291eb6d83521314b24f21b3c91263bac46788640854938367e311139c4ca8d5ec29cf3332f3ef8f98b96c2d2cd81b");
        expect(await nftContract.balanceOf(user2.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(2)).to.be.equal("uri_3");
    });
});