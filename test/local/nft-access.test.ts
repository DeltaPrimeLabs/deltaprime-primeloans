import chai, {expect} from 'chai'
import {ethers} from 'hardhat'
import {solidity} from "ethereum-waffle";
import {
    BorrowAccessNFT,
    BorrowAccessNFT__factory,
    MockNFTAccess,
    MockNFTAccess__factory, OpenBorrowersRegistry,
    OpenBorrowersRegistry__factory
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {getFixedGasSigners} from "../_helpers";
chai.use(solidity);

describe('NFT Access test', () => {
    let accessContract: MockNFTAccess,
        nftContract: BorrowAccessNFT,
        nonERC721Contract: OpenBorrowersRegistry,
        owner: SignerWithAddress,
        other: SignerWithAddress;

    before(async() => {
        [owner, other] = await getFixedGasSigners(10000000);
        nftContract = await (new BorrowAccessNFT__factory(owner).deploy());
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

    it("should set accessNFT to a contract address as the owner", async () => {
        await accessContract.connect(owner).setAccessNFT(nftContract.address);
    });

    it("should get previously set nftAccess address as a non-owner", async () => {
        accessContract.connect(other);
        const nftAddress = await accessContract.getAccessNFT();
        expect(nftAddress).to.be.equal(nftContract.address);
    });
});