import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import FixedRatesCalculatorArtifact from '../../../artifacts/contracts/deprecated/FixedRatesCalculator.sol/FixedRatesCalculator.json';
import OpenBorrowersRegistryArtifact from '../../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {Pool, OpenBorrowersRegistry} from "../../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Pool with fixed rates', () => {
  let sut: Pool,
  owner: SignerWithAddress,
  user1: SignerWithAddress,
  user2: SignerWithAddress,
  user3: SignerWithAddress,
  mockFixedRatesCalculator;

  beforeEach(async () => {
    [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
    mockFixedRatesCalculator = await deployMockContract(owner, FixedRatesCalculatorArtifact.abi);
    await mockFixedRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
    await mockFixedRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

    sut = await deployContract(owner, PoolArtifact) as Pool;

    const borrowersRegistry = await deployContract(owner, OpenBorrowersRegistryArtifact) as OpenBorrowersRegistry;

    await sut.initialize(mockFixedRatesCalculator.address, borrowersRegistry.address, ZERO, ZERO);
  });

  describe("should properly calculate deposits for: ", () => {

    it("user1 1 year, user2 0 years", async function () {
      await sut.connect(user1).deposit({value: toWei("1.0")});

      await time.increase(time.duration.years(1));

      await sut.connect(user2).deposit({value: toWei("1.0")});

      const user1Deposit = await sut.balanceOf(user1.address);
      const user2Deposit = await sut.balanceOf(user2.address);
      expect(fromWei(user1Deposit)).to.be.closeTo(1.051271, 0.000001);
      expect(fromWei(user2Deposit)).to.be.closeTo(1, 0.000001);
    });

    it("user1 deposits for 2 years, user2 deposits after 1 year", async function () {
      await sut.connect(user1).deposit({value: toWei("1.0")});

      await time.increase(time.duration.years(1));

      await sut.connect(user2).deposit({value: toWei("1.0")});

      await time.increase(time.duration.years(1));

      const user1Deposit = await sut.balanceOf(user1.address);
      const user2Deposit = await sut.balanceOf(user2.address);
      expect(fromWei(user1Deposit)).to.be.closeTo(1.105170, 0.000001);
      expect(fromWei(user2Deposit)).to.be.closeTo(1.051271, 0.000001);
    });

    it("user1 deposits for 1 year and withdraws, " +
      "user2 deposits after 2 years, " +
      "user 3 borrows for year and repays",
      async function () {
      await sut.connect(user1).deposit({value: toWei("1.0")});
      await sut.connect(user2).deposit({value: toWei("1.0")});
      await sut.connect(user3).borrow(toWei("1.0"));

      await time.increase(time.duration.years(1));

      let toRepay = await sut.getBorrowed(user3.address);
      await sut.connect(user3).repay({value: toRepay});

      let user1Deposit = await sut.balanceOf(user1.address);
      expect(fromWei(user1Deposit)).to.be.closeTo(1.051271, 0.000001);
      await sut.connect(user1).withdraw(toRepay);

      await time.increase(time.duration.years(1));

      user1Deposit = await sut.balanceOf(user1.address);
      const user2Deposit = await sut.balanceOf(user2.address);

      expect(fromWei(user1Deposit)).to.be.closeTo(0, 0.000001);
      expect(fromWei(user2Deposit)).to.be.closeTo(1.105170, 0.000001);
    });

    it("user1 deposits and after year withdraws, " +
      "user2 borrows and after year repays, " +
      "user3 deposits after year",
      async function () {
      await sut.connect(user1).deposit({value: toWei("2.0")});
      await sut.connect(user2).borrow(toWei("1.0"));

      await time.increase(time.duration.years(1));
      let toRepay = await sut.getBorrowed(user2.address);
      await sut.connect(user2).repay({value: toRepay});

      await sut.connect(user1).withdraw(toRepay);

      await sut.connect(user3).deposit({value: toWei("1.0")});

      await time.increase(time.duration.years(1));

      let user1Deposit = await sut.balanceOf(user1.address);
      const user2Deposit = await sut.balanceOf(user3.address);
      expect(fromWei(user1Deposit)).to.be.closeTo(1.10517093, 0.000001);
      expect(fromWei(user2Deposit)).to.be.closeTo(1.051271, 0.000001);
    });
  });
});

