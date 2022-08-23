import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import WrappedNativeTokenPoolArtifact from '../../artifacts/contracts/WrappedNativeTokenPool.sol/WrappedNativeTokenPool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import WETH9Artifact from "../../artifacts/contracts/lib/WETH9.sol/WETH9.json";
import {LinearIndex, OpenBorrowersRegistry, WrappedNativeTokenPool, WETH9} from "../../typechain";
import {Contract} from "ethers";

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function transfer(address _to, uint256 _value) public returns (bool success)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

const wavaxAbi = [
    'function deposit() public payable',
    ...erc20ABI
]

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Wrapped native token pool', () => {
    let sut: WrappedNativeTokenPool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositor2: SignerWithAddress,
        depositor3: SignerWithAddress,
        wavax: Contract,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, depositor, depositor2, depositor3] = await getFixedGasSigners(10000000);
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        sut = (await deployContract(owner, WrappedNativeTokenPoolArtifact)) as WrappedNativeTokenPool;

        wavax = (await deployContract(owner, WETH9Artifact)) as WETH9;

        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(sut.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(sut.address);

        await sut.initialize(
            mockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            wavax.address
        );

        await wavax.connect(depositor).deposit({value: toWei("10")});
    });

    it("should deposit requested value in native token", async () => {
        await sut.connect(depositor).depositNativeToken({value: toWei("1.0")});

        expect(fromWei(await wavax.balanceOf(sut.address))).to.equal(1);
        expect(fromWei(await sut.totalSupply())).to.equal(1);
        expect(fromWei(await sut.balanceOf(depositor.address))).to.equal(1);
    });

    it("should deposit requested value in wrapped token", async () => {
        await wavax.connect(depositor).approve(sut.address, toWei("1.0"));
        await sut.connect(depositor).deposit(toWei("1.0"));

        expect(fromWei(await sut.balanceOf(depositor.address))).to.closeTo(2, 0.000001);
        expect(fromWei(await wavax.balanceOf(sut.address))).to.equal(2);
        expect(fromWei(await sut.totalSupply())).to.be.closeTo(2, 0.000001);

        expect(fromWei(await sut.balanceOf(depositor.address))).to.be.closeTo(2, 0.000001);
    });
});

