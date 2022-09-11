import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import EarlyAccessNFTArtifact from '../../artifacts/contracts/ERC721/EarlyAccessNFT.sol/EarlyAccessNFT.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners} from "../_helpers";
import {BorrowAccessNFT} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('ERC721 with multi URI, owner-only minting and pausability', () => {
    let owner: SignerWithAddress,
        user: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress,
        nftContract: Contract;

    before(async () => {
        [owner, user, user2, user3] = await getFixedGasSigners(10000000);
        nftContract = (await deployContract(owner, EarlyAccessNFTArtifact, ["test-arweave-link"])) as BorrowAccessNFT;
        await nftContract.connect(owner).setTrustedSigner("0xdD2FD4581271e230360230F9337D5c0430Bf44C0");
    });


    it("should fail to mint an NFT token with an invalid signature", async () => {
        await expect(nftContract.connect(user).safeMint("123456", "0x03eda92dd1684ecfde8c5cefceb75326aad40977430849161bee9627cafa5bb43911440abe7977f3354b25ef3a1058e1332a0b414abcaf7ef960ebab37fb6a671c")).to.be.revertedWith("Signer not authorized");
    });

    it("should mint 1 NFT", async () => {
        await nftContract.connect(user).safeMint("700052663748001973", "0x03eda92dd1684ecfde8c5cefceb75326aad40977430849161bee9627cafa5bb43911440abe7977f3354b25ef3a1058e1332a0b414abcaf7ef960ebab37fb6a671c");

        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(0)).to.be.equal("test-arweave-link");
    });

    it("should fail to mint an NFT token for a user that has already minted one", async () => {
        await expect(nftContract.connect(user).safeMint("700052663748001973", "0x03eda92dd1684ecfde8c5cefceb75326aad40977430849161bee9627cafa5bb43911440abe7977f3354b25ef3a1058e1332a0b414abcaf7ef960ebab37fb6a671c")).to.be.revertedWith("Only one NFT per one user is allowed");
    });

    it("should fail to airdropMint as a non-owner", async () => {
        await expect(nftContract.connect(user).airdropMint([user.address, user2.address, user3.address])).to.be.revertedWith('Ownable: caller is not the owner');

    });

    it("should airdrop only once to 2 users skipping 1 that already has an NFT and double addresses", async () => {
        await (nftContract.connect(owner).airdropMint([user.address, user2.address, user3.address, user3.address]));

        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(0)).to.be.equal("test-arweave-link");
        expect(await nftContract.balanceOf(user2.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(1)).to.be.equal("test-arweave-link");
        expect(await nftContract.balanceOf(user3.address)).to.be.equal(1);
        expect(await nftContract.tokenURI(2)).to.be.equal("test-arweave-link");
        await expect(nftContract.tokenURI(3)).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token");
    });

    it("should unpause contract", async () => {
        await expect(nftContract.connect(user).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
        await nftContract.connect(owner).unpause()
        expect(await nftContract.connect(owner).paused()).to.be.false;
        await expect(nftContract.connect(owner).unpause()).to.be.revertedWith("Pausable: not paused")
    });

    it("should allow transferring tokens from and to all users", async () => {
        await nftContract.connect(user2)["safeTransferFrom(address,address,uint256)"](user2.address, user.address, 1);
        expect(await nftContract.balanceOf(user2.address)).to.be.equal(0);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(2);

        await nftContract.connect(user)["safeTransferFrom(address,address,uint256)"](user.address, user2.address, 1);
        expect(await nftContract.balanceOf(user2.address)).to.be.equal(1);
        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
    });

    it("should pause contract", async () => {
        await expect(nftContract.connect(user).pause()).to.be.revertedWith("Ownable: caller is not the owner");
        await nftContract.connect(owner).pause()
        expect(await nftContract.connect(owner).paused()).to.be.true;
        await expect(nftContract.connect(owner).pause()).to.be.revertedWith("Pausable: paused")
    });

    it("should not allow to transfer", async () => {
        await expect(nftContract.connect(user2)["safeTransferFrom(address,address,uint256)"](user2.address, user.address, 1)).to.be.revertedWith("Pausable: paused");
    });
});