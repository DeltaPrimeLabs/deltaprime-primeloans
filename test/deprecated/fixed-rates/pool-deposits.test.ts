import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import FixedRatesCalculatorArtifact
  from '../../../artifacts/contracts/deprecated/FixedRatesCalculator.sol/FixedRatesCalculator.json';
import OpenBorrowersRegistryArtifact
  from '../../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {CompoundingIndex, OpenBorrowersRegistry, Pool} from "../../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with fixed interest rates', () => {
  let sut: Pool,
    owner: SignerWithAddress,
    user: SignerWithAddress,
    user2: SignerWithAddress,
    mockFixedRatesCalculator;

  beforeEach(async () => {
    [owner, user, user2] = await getFixedGasSigners(10000000);
    mockFixedRatesCalculator = await deployMockContract(owner, FixedRatesCalculatorArtifact.abi);
    await mockFixedRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
    await mockFixedRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

    sut = (await deployContract(owner, PoolArtifact)) as Pool;

    const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
    const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;
    const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;

    await sut.initialize(
        mockFixedRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
    );
  });

  it("should deposit requested value", async () => {
    await sut.deposit({value: toWei("1.0")});
    expect(await provider.getBalance(sut.address)).to.equal(toWei("1"));

    const currentDeposits = await sut.balanceOf(owner.address);
    expect(fromWei(currentDeposits)).to.equal(1);
  });

  it("should deposit on proper address", async () => {
    await sut.deposit({value: toWei("3.0")});
    await sut.connect(user).deposit({value: toWei("5.0")});
    await sut.connect(user2).deposit({value: toWei("7.0")});

    expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(3.00000, 0.00001);
    expect(fromWei(await sut.balanceOf(user.address))).to.be.closeTo(5.00000, 0.00001);
    expect(fromWei(await sut.balanceOf(user2.address))).to.be.closeTo(7.00000, 0.00001);
  });

  describe("should increase deposit value as time goes", () => {

    it("should hold for one year", async function () {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(1));

      const oneYearDeposit = await sut.balanceOf(owner.address);
      expect(fromWei(oneYearDeposit)).to.be.closeTo(1.051271, 0.000001);
    });

    it("should hold for two years", async function () {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(2));

      const twoYearsDeposit = await sut.balanceOf(owner.address);
      expect(fromWei(twoYearsDeposit)).to.be.closeTo(1.105170, 0.000001);
    });

    it("should hold for three years", async function () {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(3));

      const threeYearsDeposit = await sut.balanceOf(owner.address);
      expect(fromWei(threeYearsDeposit)).to.be.closeTo(1.161834, 0.000001);
    });

    it("should hold for five years", async function () {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(5));

      const fiveYearsDeposit = await sut.balanceOf(owner.address);
      expect(fromWei(fiveYearsDeposit)).to.be.closeTo(1.284025, 0.000001);
    });

    it("should hold for ten years", async function () {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(10));
      const tenYearsDeposit = await sut.balanceOf(owner.address);
      expect(fromWei(tenYearsDeposit)).to.be.closeTo(1.6487212, 0.000001);
    });

    describe("after half year delay", () => {
      it("should increase deposit after half year", async function () {
        await sut.deposit({value: toWei("1.0")});
        expect(await provider.getBalance(sut.address)).to.equal(toWei("1"));

        await time.increase(time.duration.years(0.5));
        const halfYearDeposit = await sut.balanceOf(owner.address);
        expect(fromWei(halfYearDeposit)).to.be.closeTo(1.025315122129735, 0.000001);
      });
    });

    describe("after 1 year delay", () => {
      beforeEach(async () => {
        await time.increase(time.duration.years(1));
      });

      it("should not change deposit value", async function () {
        const oneYearDeposit = await sut.balanceOf(owner.address);
        expect(fromWei(oneYearDeposit)).to.be.closeTo(0, 0.000001);
      });

      it("should increase deposit after another year", async function () {
        await sut.deposit({value: toWei("1.0")});
        expect(await provider.getBalance(sut.address)).to.equal(toWei("1"));

        await time.increase(time.duration.years(1));
        const oneYearDeposit = await sut.balanceOf(owner.address);
        expect(fromWei(oneYearDeposit)).to.be.closeTo(1.051271, 0.000001);
      });
    });

  });

  describe('should properly make multiple deposits', () => {
    beforeEach(async () => {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(1));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(1.051271, 0.000001);
    });

    it("should properly make another deposits", async () => {
      await sut.deposit({value: toWei("1.0")});
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(2.051271, 0.000001);

      await sut.deposit({value: toWei("2.0")});
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(4.051271, 0.000001);

      await sut.deposit({value: toWei("5.7")});
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(9.751271, 0.000001);

      await sut.deposit({value: toWei("3.00083")});
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(12.752101, 0.000001);
    });

    it("should properly make another deposits with different time gaps", async () => {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.months(6));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(2.102479, 0.000001);

      await sut.deposit({value: toWei("2.0")});
      await time.increase(time.duration.years(3));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(4.766400, 0.000001);

      await sut.deposit({value: toWei("5.7")});
      await time.increase(time.duration.months(3));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(10.596237, 0.000001);

      await sut.deposit({value: toWei("3.00083")});
      await time.increase(time.duration.years(1));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(14.294203, 0.000001);
    });

  });

  describe("withdraw function", () => {
    it("should not allow to withdraw when user has no deposit", async () => {
      await sut.connect(user).deposit({value: toWei("0.5")});
      await expect(sut.connect(user2).withdraw(toWei("0.5")))
        .to.be.revertedWith("ERC20: burn amount exceeds user balance");
      await expect(sut.connect(user2).withdraw(toWei("0.000000001")))
        .to.be.revertedWith("ERC20: burn amount exceeds user balance");
      ;
    });

    it("should not allow to withdraw more than already on deposit", async () => {
      await sut.connect(user).deposit({value: toWei("1.0")});
      await sut.connect(user2).deposit({value: toWei("1.0")});
      await expect(sut.connect(user).withdraw(toWei("1.0001")))
        .to.be.revertedWith("ERC20: burn amount exceeds user balance");
    });

    it("should not allow to withdraw more than already on deposit after accumulating interest", async () => {
      await sut.connect(user).deposit({value: toWei("1.0")});
      await sut.connect(user2).deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(1));

      expect(fromWei(await sut.connect(user).balanceOf(user.address))).to.be.closeTo(1.05127, 0.00001);
      await expect(sut.connect(user).withdraw(toWei("1.0513")))
        .to.be.revertedWith("ERC20: burn amount exceeds user balance");
    });

    it("should allow to withdraw all deposit", async () => {
      await sut.deposit({value: toWei("1.0")});

      await sut.withdraw(toWei("1.0"))

      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(0, 0.000001);
    });

    it("should allow to withdraw all deposit after multiple deposits", async () => {
      await sut.deposit({value: toWei("1.0")});
      await sut.deposit({value: toWei("2.5")});
      await sut.deposit({value: toWei("3.7")});

      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(7.2000, 0.000001);

      await sut.withdraw(toWei("7.2000"));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(0, 0.000001);
    });

    it("should allow to withdraw part of the deposit", async () => {
      await sut.deposit({value: toWei("1.0")});
      await time.increase(time.duration.years(1));
      await sut.withdraw(toWei("0.2000"));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(0.85127, 0.00001);

      await sut.deposit({value: toWei("2.5")});
      await time.increase(time.duration.years(3));
      await sut.withdraw(toWei("1.3000"));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(2.59362, 0.00001);

      await sut.deposit({value: toWei("3.7")});
      await time.increase(time.duration.years(3));
      await sut.withdraw(toWei("2.1400"));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(5.172145, 0.000001);
    });

    it("should withdraw deposit from proper address", async () => {
      await sut.deposit({value: toWei("3.0")});
      await sut.connect(user).deposit({value: toWei("5.0")});

      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(3.00000, 0.00001);
      expect(fromWei(await sut.balanceOf(user.address))).to.be.closeTo(5.00000, 0.00001);

      await sut.connect(owner).withdraw(toWei("1.000"));
      expect(fromWei(await sut.balanceOf(owner.address))).to.be.closeTo(2.00000, 0.00001);

      await sut.connect(user).withdraw(toWei("2.000"));
      expect(fromWei(await sut.balanceOf(user.address))).to.be.closeTo(3.00000, 0.00001);
    });

  });

});

