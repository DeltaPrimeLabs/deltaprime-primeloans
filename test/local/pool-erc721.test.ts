import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import MockDepositAccessNFTArtifact
    from '../../artifacts/contracts/mock/MockDepositAccessNFT.sol/MockDepositAccessNFT.json';
import PoolWithAccessNFTArtifact from '../../artifacts/contracts/upgraded/PoolWithAccessNFT.sol/PoolWithAccessNFT.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {
    LinearIndex,
    MockDepositAccessNFT,
    MockToken,
    OpenBorrowersRegistry,
    PoolWithAccessNFT,
    VariableUtilisationRatesCalculator
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Pool with ERC721 Alpha access', () => {
    let sut: PoolWithAccessNFT,
        mockUsdToken: MockToken,
        owner: SignerWithAddress,
        user: SignerWithAddress,
        user2: SignerWithAddress,
        variableUtilisationRatesCalculator: VariableUtilisationRatesCalculator,
        nftContract: Contract,
        tokenContract: Contract;


    before(async () => {
        [owner, user, user2] = await getFixedGasSigners(10000000);
        variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;

        mockUsdToken = (await deployContract(owner, MockTokenArtifact, [[user.address, user2.address]])) as MockToken;
        tokenContract = new ethers.Contract(mockUsdToken.address, erc20ABI, provider);

        nftContract = (await deployContract(owner, MockDepositAccessNFTArtifact)) as MockDepositAccessNFT;

        sut = (await deployContract(owner, PoolWithAccessNFTArtifact)) as PoolWithAccessNFT;

        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        await sut.initialize(
            variableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockUsdToken.address,
            ZERO,
            0
        );
    });

    it("should deposit requested value without the access ERC721", async () => {
        await tokenContract.connect(user).approve(sut.address, toWei("1"));
        await sut.connect(user).deposit(toWei("1.0"));
        expect(await tokenContract.balanceOf(sut.address)).to.equal(toWei("1"));

        const currentDeposits = await sut.balanceOf(user.address);
        expect(fromWei(currentDeposits)).to.equal(1);
    });

    it("should fail to set the access ERC721 address", async () => {
        await expect(sut.connect(user2).setAccessNFT(nftContract.address)).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set the access ERC721 address", async () => {
        await sut.connect(owner).setAccessNFT(nftContract.address);
    });

    it("should fail to deposit requested value without the depositor access ERC721", async () => {
        await tokenContract.connect(user).approve(sut.address, toWei("1.0"));
        await expect(sut.connect(user).deposit(toWei("1.0"))).to.be.revertedWith("Access NFT required");
    });

    it("should mint the depositor access ERC721", async () => {
        await nftContract.connect(owner).addAvailableUri(["uri_1", "uri_2"]);
        await nftContract.connect(user).safeMint("580528284777971734", "0x536aac0a69dea94674eb85fbad6dadf0460ac6de584a3429f1c39e99de67a72d7e7c2f246ab9c022d9341c26d187744ad8ccdfc5986cfc74e1fa2a5e1a4555381b");
        expect(await nftContract.balanceOf(user.address)).to.be.equal(1);
    });

    it("should deposit requested value with the depositor access ERC721", async () => {
        await tokenContract.connect(user).approve(sut.address, toWei("1.0"));
        await sut.connect(user).deposit(toWei("1.0"));

        const currentDeposits = await sut.balanceOf(user.address);
        expect(fromWei(currentDeposits)).to.closeTo(2, 0.0000001);
    });
});