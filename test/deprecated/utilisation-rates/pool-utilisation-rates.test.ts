import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import UtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/deprecated/UtilisationRatesCalculator.sol/UtilisationRatesCalculator.json';
import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';

import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../../_helpers";
import {CompoundingIndex, OpenBorrowersRegistry__factory, Pool, UtilisationRatesCalculator} from "../../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with utilisation interest rates', () => {

  describe('Deposit, borrow, wait & borrow more', () => {
    let pool: Pool,
      owner: SignerWithAddress,
      borrower: SignerWithAddress,
      depositor: SignerWithAddress,
      ratesCalculator: UtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, borrower, depositor] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(borrower, UtilisationRatesCalculatorArtifact, [toWei("0.5"), toWei("0.05")])) as UtilisationRatesCalculator;
      pool = (await deployContract(borrower, PoolArtifact)) as Pool;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(borrower).deploy());
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      await pool.initialize(
        ratesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );

    });

    it("should deposit", async () => {
      await pool.connect(depositor).deposit({value: toWei("1.0")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

      const currentDeposits = fromWei(await pool.balanceOf(depositor.address));
      expect(currentDeposits).to.be.closeTo(1.000000, 0.000001);

      const depositRate = fromWei(await pool.getDepositRate());
      expect(depositRate).to.be.closeTo(0, 0.000001);

      const borrowingRate = fromWei(await pool.getBorrowingRate());
      expect(borrowingRate).to.be.closeTo(0.05, 0.000001);
    });


    it("should borrow", async () => {
      await pool.borrow(toWei("0.5"));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

      const currentDeposits = fromWei(await pool.balanceOf(depositor.address));
      expect(currentDeposits).to.be.closeTo(1.000000, 0.000001);

      const currentBorrowed = fromWei(await pool.getBorrowed(borrower.address));
      expect(currentBorrowed).to.be.closeTo(0.5, 0.000001);

      const depositRate = fromWei(await pool.getDepositRate());
      expect(depositRate).to.be.closeTo(0.15, 0.000001);

      const borrowingRate = fromWei(await pool.getBorrowingRate());
      expect(borrowingRate).to.be.closeTo(0.3, 0.000001);
    });


    it("should accumulate interest for 1 year", async () => {
      await time.increase(time.duration.years(1));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

      const currentDeposits = fromWei(await pool.balanceOf(depositor.address));
      expect(currentDeposits).to.be.closeTo(1.161834, 0.000001);

      const currentBorrowed = fromWei(await pool.getBorrowed(borrower.address));
      expect(currentBorrowed).to.be.closeTo(0.674929, 0.000001);

      const depositRate = fromWei(await pool.getDepositRate());
      expect(depositRate).to.be.closeTo(0.19777820662296586, 0.000001);

      const borrowingRate = fromWei(await pool.getBorrowingRate());
      expect(borrowingRate).to.be.closeTo(0.3404585617527775, 0.000001);
    });


    it("should repay part of the loan", async () => {
      await pool.repay({value: toWei("0.424929")});

      const currentDeposits = fromWei(await pool.balanceOf(depositor.address));
      expect(currentDeposits).to.be.closeTo(1.161834, 0.000001);

      const currentBorrowed = fromWei(await pool.getBorrowed(borrower.address));
      expect(currentBorrowed).to.be.closeTo(0.25, 0.000001);

      const depositRate = fromWei(await pool.getDepositRate());
      expect(depositRate).to.be.closeTo(0.03390951225679867, 0.000001);

      const borrowingRate = fromWei(await pool.getBorrowingRate());
      expect(borrowingRate).to.be.closeTo(0.1575886727001946, 0.000001);
    });


    it("should accumulate interest for another year", async () => {
      await time.increase(time.duration.years(1));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.924929", "ether"));

      const currentDeposits = fromWei(await pool.balanceOf(depositor.address));
      expect(currentDeposits).to.be.closeTo(1.2019070655842596, 0.000001);

      const currentBorrowed = fromWei(await pool.getBorrowed(borrower.address));
      expect(currentBorrowed).to.be.closeTo(0.2926716192672473, 0.000001);

      const depositRate = fromWei(await pool.getDepositRate());
      expect(depositRate).to.be.closeTo(0.0418228967112633, 0.000001);

      const borrowingRate = fromWei(await pool.getBorrowingRate());
      expect(borrowingRate).to.be.closeTo(0.1717530160174189, 0.000001);
    });

  });

});
