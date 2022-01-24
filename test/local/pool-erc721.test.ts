import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import BorrowAccessNFTArtifact from '../../artifacts/contracts/ERC721/BorrowAccessNFT.sol/BorrowAccessNFT.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {Pool, OpenBorrowersRegistry, BorrowAccessNFT} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Pool with ERC721 Alpha access', () => {
    let sut: Pool,
        owner: SignerWithAddress,
        user: SignerWithAddress,
        user2: SignerWithAddress,
        nftContract: Contract,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, user, user2] = await getFixedGasSigners(10000000);
        nftContract = (await deployContract(owner, BorrowAccessNFTArtifact)) as BorrowAccessNFT;
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;

        await sut.initialize(mockVariableUtilisationRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
    });

    it("should deposit requested value without the access ERC721", async () => {
        await sut.deposit({value: toWei("1.0")});
        expect(await provider.getBalance(sut.address)).to.equal(toWei("1"));

        const currentDeposits = await sut.balanceOf(owner.address);
        expect(fromWei(currentDeposits)).to.equal(1);
    });

    it("should fail to set the access ERC721 address", async () => {
        await expect(sut.connect(user2).setAccessNFT(nftContract.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set the access ERC721 address", async () => {
        await sut.connect(owner).setAccessNFT(nftContract.address);
    });

    it("should fail to deposit requested value without the depositor access ERC721", async () => {
        await expect(sut.deposit({value: toWei("1.0")})).to.be.revertedWith("Depositor NFT required");
    });

    it("should fail to mint the depositor access ERC721", async () => {
        await expect(nftContract.connect(user2).safeMint(owner.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should mint the depositor access ERC721", async () => {
        await nftContract.connect(owner).safeMint(owner.address);
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
    });

    it("should deposit requested value with the depositor access ERC721", async () => {
        await sut.deposit({value: toWei("1.0")});
        expect(await provider.getBalance(sut.address)).to.equal(toWei("2"));

        const currentDeposits = await sut.balanceOf(owner.address);
        expect(fromWei(currentDeposits)).to.closeTo(2, 0.0000001);
    });


});