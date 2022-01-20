import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import BorrowAccessNFTArtifact from '../../artifacts/contracts/ERC721/BorrowAccessNFT.sol/BorrowAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners} from "../_helpers";
import {BorrowAccessNFT} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('ERC721 with single URI, owner-only minting and pausability', () => {
    let owner: SignerWithAddress,
        user: SignerWithAddress,
        user2: SignerWithAddress,
        nftContract: Contract;

    before(async () => {
        [owner, user, user2] = await getFixedGasSigners(10000000);
        nftContract = (await deployContract(owner, BorrowAccessNFTArtifact)) as BorrowAccessNFT;
    });

    it("should fail to mint an NFT token as a non-owner account", async () => {
        await expect(nftContract.connect(user).safeMint(user.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should mint 3 NFT tokens with the same URI as an owner account", async () => {
        await nftContract.connect(owner).safeMint(user.address);
        await nftContract.connect(owner).safeMint(user2.address);
        await nftContract.connect(owner).safeMint(owner.address);

        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(user2.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(0)).to.be.equal("ar://arweave-hash-pointing-to-the-metadata-json");
        expect(await nftContract.tokenURI(1)).to.be.equal("ar://arweave-hash-pointing-to-the-metadata-json");
        expect(await nftContract.tokenURI(2)).to.be.equal("ar://arweave-hash-pointing-to-the-metadata-json");
        await expect(nftContract.tokenURI(3)).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token");
    });

    it("should allow transferring tokens from and to all users", async () => {
        await nftContract.connect(owner)["safeTransferFrom(address,address,uint256)"](owner.address, user.address, 2);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(0);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(2);

        await nftContract.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, owner.address, 2);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
    });

    it("should pause contract", async () => {
        await expect(nftContract.connect(user).pause()).to.be.revertedWith("Ownable: caller is not the owner");
        await nftContract.connect(owner).pause()
        expect(await nftContract.connect(owner).paused()).to.be.true;
        await expect(nftContract.connect(owner).pause()).to.be.revertedWith("Pausable: paused")
    });

    it("should only allow owner to transfer", async () => {
        await nftContract.connect(owner)["safeTransferFrom(address,address,uint256)"](owner.address, user.address, 2);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(0);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(2);

        await expect(nftContract.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, owner.address, 2)).to.be.revertedWith("Pausable: paused");
    });

    it("should allow owner to mint when paused", async () => {
        await nftContract.connect(owner).safeMint(user2.address);
        expect(await nftContract.connect(owner).paused()).to.be.true;
    });

    it("should unpause contract", async () => {
        await expect(nftContract.connect(user).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
        await nftContract.connect(owner).unpause()
        expect(await nftContract.connect(owner).paused()).to.be.false;
        await expect(nftContract.connect(owner).unpause()).to.be.revertedWith("Pausable: not paused")
    });

    it("should again allow transferring tokens from and to all users", async () => {
        await nftContract.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, owner.address, 2);

        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
    });

});