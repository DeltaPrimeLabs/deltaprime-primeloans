import {ethers, waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";

import FixedRatesCalculatorArtifact from '../../../artifacts/contracts/deprecated/FixedRatesCalculator.sol/FixedRatesCalculator.json';
import {FixedRatesCalculator} from '../../../typechain/FixedRatesCalculator';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../../_helpers";

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

describe('FixedRatesCalculator', () => {
  let sut: FixedRatesCalculator,
    owner: SignerWithAddress,
    nonOwner: SignerWithAddress;

  beforeEach(async () => {
    [owner, nonOwner] = await getFixedGasSigners(10000000);
  });

  it('should throw if deposit rate higher than borrowing rate', async () => {
    await expect(deployContract(
      owner,
      FixedRatesCalculatorArtifact,
      [toWei("1000"), toWei("500")]))
      .to.be.revertedWith("BorrowingRateLTDepositRate()");
  });

  it('should create instance if deposit rate lower than borrowing rate', async () => {
    const calc = await deployContract(owner,
      FixedRatesCalculatorArtifact,
      [toWei("1000"), toWei("1000")]) as FixedRatesCalculator;
    //expect('setRates').to.be.calledOnContractWith(calc,[toWei("999"), toWei("1000")]);
  });

  it('should create instance if deposit rate equal to borrowing rate', async () => {
    const calc = await deployContract(owner,
      FixedRatesCalculatorArtifact,
      [toWei("1000"), toWei("1000")]) as FixedRatesCalculator;
  });

  describe("setRates function", () => {
    beforeEach(async () => {
      sut = await deployContract(owner,
        FixedRatesCalculatorArtifact,
        [toWei("999"), toWei("1000")]) as FixedRatesCalculator;
    });

    it('should throw if called by non-owner', async () => {
      await expect(sut.connect(nonOwner).setRates(toWei("999"), toWei("1000")))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it('should throw if deposit rate higher than borrowing', async () => {
      await expect(sut.setRates(toWei("1001"), toWei("1000")))
        .to.be.revertedWith("BorrowingRateLTDepositRate()");
    });
  });

  describe("should always calculate the same rate",() => {
    beforeEach(async () => {
      sut = await deployContract(owner,
        FixedRatesCalculatorArtifact,
        [toWei("0.05"), toWei("0.1")]) as FixedRatesCalculator;
    });

    it("for 0% utilisation", async () => {
      const depositRate = +fromWei(await sut.calculateDepositRate(0, toWei("100")));
      expect(depositRate)
        .to.be.closeTo(0.05, 0.001);

      const borrowingRate = +fromWei(await sut.calculateBorrowingRate(0, toWei("100")));
      expect(borrowingRate)
        .to.be.closeTo(0.1, 0.001);
    });

    it("for 50% utilisation", async () => {
      const depositRate = +fromWei(await sut.calculateDepositRate(toWei("50"), toWei("100")));
      expect(depositRate)
        .to.be.closeTo(0.05, 0.001);

      const borrowingRate = +fromWei(await sut.calculateBorrowingRate(toWei("50"), toWei("100")));
      expect(borrowingRate)
        .to.be.closeTo(0.1, 0.001);
    });

    it("for 100% utilisation", async () => {
      const depositRate = +fromWei(await sut.calculateDepositRate(toWei("100"), toWei("100")));
      expect(depositRate)
        .to.be.closeTo(0.05, 0.001);

      const borrowingRate = +fromWei(await sut.calculateBorrowingRate(toWei("100"), toWei("100")));
      expect(borrowingRate)
        .to.be.closeTo(0.1, 0.001);
    });
  });
});
