import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import MockDepositAccessNFTArtifact from '../../artifacts/contracts/mock/MockDepositAccessNFT.sol/MockDepositAccessNFT.json';
import PoolWithAccessNFTArtifact from '../../artifacts/contracts/upgraded/PoolWithAccessNFT.sol/PoolWithAccessNFT.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {
    OpenBorrowersRegistry,
    MockDepositAccessNFT,
    CompoundingIndex,
    PoolWithAccessNFT
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with ERC721 Alpha access', () => {
    let sut: PoolWithAccessNFT,
        owner: SignerWithAddress,
        user: SignerWithAddress,
        user2: SignerWithAddress,
        nftContract: Contract,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, user, user2] = await getFixedGasSigners(10000000);
        nftContract = (await deployContract(owner, MockDepositAccessNFTArtifact)) as MockDepositAccessNFT;
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        sut = (await deployContract(owner, PoolWithAccessNFTArtifact)) as PoolWithAccessNFT;

        const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;
        const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;


        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;

        await sut.initialize(
            mockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address
        );
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
        await expect(sut.deposit({value: toWei("1.0")})).to.be.revertedWith("Access NFT required");
    });

    it("should mint the depositor access ERC721", async () => {
        await nftContract.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
        await nftContract.connect(owner).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");
        expect(await nftContract.balanceOf(owner.address)).to.be.equal(1);
    });

    it("should deposit requested value with the depositor access ERC721", async () => {
        await sut.deposit({value: toWei("1.0")});
        expect(await provider.getBalance(sut.address)).to.equal(toWei("2"));

        const currentDeposits = await sut.balanceOf(owner.address);
        expect(fromWei(currentDeposits)).to.closeTo(2, 0.0000001);
    });


});