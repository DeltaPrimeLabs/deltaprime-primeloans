import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import WAVAXArtifact from "../../artifacts/contracts/mock/WAVAX.sol/WAVAX.json";
import WavaxPoolArtifact from '../../artifacts/contracts/WavaxPool.sol/WavaxPool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {LinearIndex, OpenBorrowersRegistry, WavaxPool, WAVAX} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

describe('Pool with variable utilisation interest rates', () => {
    let sut: WavaxPool,
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

        sut = (await deployContract(owner, WavaxPoolArtifact)) as WavaxPool;

        wavax = (await deployContract(owner, WAVAXArtifact)) as WAVAX;

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

