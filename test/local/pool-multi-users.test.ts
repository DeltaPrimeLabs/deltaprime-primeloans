import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
  OpenBorrowersRegistry__factory,
  Pool,
  VariableUtilisationRatesCalculator
} from "../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Pool with variable interest rates', () => {

  describe('Deposit, borrow, wait & borrow more', () => {
    let pool: Pool,
      owner: SignerWithAddress,
      user1: SignerWithAddress,
      user2: SignerWithAddress,
      user3: SignerWithAddress,
      user4: SignerWithAddress,
      ratesCalculator: VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, user1, user2, user3, user4] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());

      await pool.initialize(ratesCalculator.address, borrowersRegistry.address, ZERO, ZERO);

    });

    it("user1 deposits", async () => {
      await pool.connect(user1).deposit({value: toWei("1.0")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.05, 0.000001);
    });


    it("user2 borrows", async () => {
      await pool.connect(user2).borrow(toWei("0.9"));
      expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.1);

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.000000, 0.000001);
      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0.9, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.4032, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.448 , 0.000001);
    });


    it("should accumulate interest for first year", async () => {
      await time.increase(time.duration.years(1));
      expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.1);

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.4966061791124947, 0.000001);

      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.408660821605612, 0.000001);
      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.5388911637523081, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.5725351616650157, 0.000001);
    });

    it("user3 deposits", async () => {
      await pool.connect(user3).deposit({value: toWei("1.0")});
      expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(1.1);

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.4966061982471854, 0.000001);
      expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(2, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.09474628204158164, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.1345196516977068, 0.000001);
    });

    it("should accumulate interest for second year", async () => {
      await time.increase(time.duration.years(1));
      expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(1.1);

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(1.645338758296705, 0.000001);
      expect(fromWei(await pool.balanceOf(user3.address))).to.be.closeTo( 1.0993798895704687, 0.000001);
      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(1.6114898851341786, 0.000001);
    });

    it("user4 borrows", async () => {
      await pool.connect(user4).borrow(toWei("0.5"));

      expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.6);

      expect(fromWei(await pool.getBorrowed(user4.address))).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.08048600621853, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.1264067093424, 0.000001);
    });


    it("should accumulate interest for another year", async () => {
      await time.increase(time.duration.years(1));

      const poolBalance = fromWei(await provider.getBalance(pool.address));
      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));
      const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

      expect(depositUser1).to.be.closeTo(1.78324065, 0.000001);
      expect(depositUser3).to.be.closeTo(1.19152296986, 0.000001);
      expect(borrowedUser2).to.be.closeTo(1.82862782495, 0.000001);
      expect(borrowedUser4).to.be.closeTo(0.56737179248, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.086661708570, 0.000001);

      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.12999716676, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    });

    it("user2 repays full loan", async () => {
      await pool.connect(user2).repay({value: await pool.getBorrowed(user2.address)});

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.4286278250, 0.000001);

      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(0, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo( 0.01577348157705, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.075177861593, 0.000001);
    });

    it("should accumulate interest for another year", async () => {
      await time.increase(time.duration.years(1));

      const poolBalance = fromWei(await provider.getBalance(pool.address));
      expect(poolBalance).to.be.closeTo(2.4286278250, 0.000001);

      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));
      expect(depositUser1).to.be.closeTo(1.81159161212, 0.000001);
      expect(depositUser3).to.be.closeTo(1.210466445818, 0.000001);
      expect(borrowedUser4).to.be.closeTo(0.61166984807, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser4 + poolBalance);
    });

    it("user4 repays part of loan, user1 withdraws all deposit", async () => {
      await pool.connect(user4).repay({value: toWei("0.5")});

      const borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));
      const borrowedUser4 = fromWei(await pool.getBorrowed(user4.address));

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(2.92862785282, 0.000001);


      await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));

      const depositUser1 = fromWei(await pool.balanceOf(user1.address));
      const depositUser3 = fromWei(await pool.balanceOf(user3.address));

      expect(depositUser1).to.be.closeTo( 0, 0.000001);
      expect(depositUser3).to.be.closeTo(1.210466446597, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.0070799116888, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.0634003830261, 0.000001);

      const poolBalance = fromWei(await provider.getBalance(pool.address));

      expect(poolBalance).to.be.closeTo(1.11703623979077, 0.000001);

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
      expect(depositUser3).to.be.closeTo(1.2190668515, 0.000001);
      expect(borrowedUser2).to.be.closeTo(0, 0.000001);
      expect(borrowedUser4).to.be.closeTo(0.1189790163372, 0.000001);

      expect(depositUser1 + depositUser3).to.be.below(borrowedUser2 + borrowedUser4 + poolBalance);
    });
  });
});
