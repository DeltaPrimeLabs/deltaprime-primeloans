import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import UtilisationRatesCalculatorArtifact
  from '../../../artifacts/contracts/deprecated/UtilisationRatesCalculator.sol/UtilisationRatesCalculator.json';
import PoolArtifact from '../../../artifacts/contracts/Pool.sol/Pool.json';
import DepositIndexArtifact from '../../../artifacts/contracts/DepositIndex.sol/DepositIndex.json';
import BorrowingIndexArtifact from '../../../artifacts/contracts/BorrowingIndex.sol/BorrowingIndex.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../../_helpers";
import {
  BorrowingIndex,
  DepositIndex,
  OpenBorrowersRegistry__factory,
  Pool,
  UtilisationRatesCalculator
} from "../../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Pool with utilisation interest rates', () => {

  describe('Deposit, borrow, wait & borrow more', () => {
    let pool: Pool,
      owner: SignerWithAddress,
      user1: SignerWithAddress,
      user2: SignerWithAddress,
      user3: SignerWithAddress,
      user4: SignerWithAddress,
      ratesCalculator: UtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, user1, user2, user3, user4] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(owner, UtilisationRatesCalculatorArtifact, [toWei("0.5"), toWei("0.05")])) as UtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, DepositIndexArtifact, [pool.address])) as DepositIndex;
      const borrowingIndex = (await deployContract(owner, BorrowingIndexArtifact, [pool.address])) as BorrowingIndex;

      await pool.initialize(
          ratesCalculator.address,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address
      );

    });

    it("user1 deposits", async () => {
      await pool.connect(user1).deposit({value: toWei("1.0")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);
    });


    it("user2 borrows", async () => {
      await pool.connect(user2).borrow(toWei("0.5"));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.5, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.15, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.3, 0.000001);
    });


    it("should accumulate interest for first year", async () => {
      await time.increase(time.duration.years(1));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.161834, 0.000001);

      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.674929, 0.000001);
      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.19777820662296586, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.34045856037122046, 0.000001);
    });

    it("user3 deposits", async () => {
      await pool.connect(user3).deposit({value: toWei("1.0")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1.5", "ether"));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.161834, 0.000001);
      expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(2, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.07381444866419332, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.21873235231136967, 0.000001);
    });

    it("should accumulate interest for second year", async () => {
      await time.increase(time.duration.years(1));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1.5", "ether"));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.2508389113880019, 0.000001);
      expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo( 1.0766070235177052, 0.000001);
      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.8399483972129508, 0.000001);
    });

    it("user4 borrows", async () => {
      await pool.connect(user4).borrow(toWei("1"));

      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.5", "ether"));

      expect(fromWei(await pool.getBorrowed(user4.address))).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.2774804305712188, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.398316508187904, 0.000001);
    });


    it("should accumulate interest for another year", async () => {
      await time.increase(time.duration.years(1));

      const poolBalance = fromWei(await provider.getBalance(pool.address));
      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));
      const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

      expect(depositUser1).to.be.closeTo( 1.6508575612844567, 0.000001);
      expect(depositUser3).to.be.closeTo(1.4209062646875414, 0.000001);
      expect(borrowedUser2).to.be.closeTo(1.2509480358124927, 0.000001);
      expect(borrowedUser4).to.be.closeTo(1.489315351448875, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.3482887189309751, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.4430542546177882, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    });

    it("user2 repays full loan", async () => {
      await pool.connect(user2).repay({value: await pool.getBorrowed(user2.address)});

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.7509480434691373, 0.000001);

      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.07950702182205527, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.2259440494029352, 0.000001);
    });

    it("should accumulate interest for another year", async () => {
      await time.increase(time.duration.years(1));

      const poolBalance = fromWei(await provider.getBalance(pool.address));
      expect(poolBalance).to.be.closeTo(1.7509480434691373, 0.000001);

      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
      expect(depositUser1).to.be.closeTo( 1.787471265212312, 0.000001);
      expect(depositUser3).to.be.closeTo(1.5384907634674478, 0.000001);
      expect(borrowedUser4).to.be.closeTo(1.866865046348776, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser4 + poolBalance);
    });

    it("user4 repays part of loan, user1 withdraws all deposit", async () => {
      await pool.connect(user4).repay({value: toWei("1")});

      const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(  0.05377099981478631, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.19086289672672138, 0.000001);

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.7509480358124927, 0.000001);

      await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));

      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));

      expect(depositUser1).to.be.closeTo( 0, 0.000001);
      expect(depositUser3).to.be.closeTo(1.5384907823804526, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.41907078574606166, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.4834325395668470, 0.000001);

      const poolBalance = fromWei(await provider.getBalance(pool.address));

      expect(poolBalance).to.be.closeTo(0.9634767782568253, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);

    });

    it("should accumulate interest for another year", async () => {
      await time.increase(time.duration.years(1));

      const poolBalance = fromWei(await provider.getBalance(pool.address));
      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));
      const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

      expect(depositUser1).to.be.closeTo( 0, 0.000001);
      expect(depositUser3).to.be.closeTo(2.3393490511978903, 0.000001);
      expect(borrowedUser2).to.be.closeTo(0, 0.000001);
      expect(borrowedUser4).to.be.closeTo(1.4057354062114045, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    });
  });
});
