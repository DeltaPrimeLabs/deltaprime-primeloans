import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';

import DestructableArtifact from '../../artifacts/contracts/mock/DestructableContract.sol/DestructableContract.json';
import OpenBorrowersRegistryArtifact from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
  DestructableContract,
  LinearIndex,
  OpenBorrowersRegistry,
  OpenBorrowersRegistry__factory,
  Pool,
  VariableUtilisationRatesCalculator,
} from "../../typechain";
import {BigNumber} from "ethers";

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Safety tests of pool', () => {
  describe('Intializing a pool', () => {
    let pool: Pool,
        owner: SignerWithAddress,
        nonContractAddress: string,
        ratesCalculator: VariableUtilisationRatesCalculator,
        borrowersRegistry: OpenBorrowersRegistry,
        depositIndex: LinearIndex,
        borrowingIndex: LinearIndex;

    before("Deploy a pool contract", async () => {
      [owner] = await getFixedGasSigners(10000000);
      nonContractAddress = '88a5c2d9919e46f883eb62f7b8dd9d0cc45bc290';
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await depositIndex.initialize(pool.address);
      borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await borrowingIndex.initialize(pool.address);
    });

    it("should not allow initializing pool with a non-contract ratesCalculator", async () => {
      await expect(
        pool.initialize(
          nonContractAddress,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address
        )).to.be.revertedWith("function call to a non-contract account");
    });

    it("should not allow initializing pool with a non-contract borrowersRegistry", async () => {
      await expect(
        pool.initialize(
          ratesCalculator.address,
          nonContractAddress,
          depositIndex.address,
          borrowingIndex.address
        )).to.be.revertedWith("Must be a contract");
    });

    it("should initialize a pool", async () => {
      await pool.initialize(
        ratesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
    });

    it("should not allow setting a non-contract ratesCalculator", async () => {
      await expect(pool.setRatesCalculator(nonContractAddress)).to.be.revertedWith("Must be a contract");
    });

    it("should not allow setting a non-contract borrowersRegistry", async () => {
      await expect(pool.setBorrowersRegistry(nonContractAddress)).to.be.revertedWith("Must be a contract");
    });
  });

  describe('Forcefully fund pool', () => {
    let pool: Pool,
      destructable: DestructableContract,
      owner: SignerWithAddress,
      user1: SignerWithAddress,
      user2: SignerWithAddress,
      user3: SignerWithAddress,
      ratesCalculator: VariableUtilisationRatesCalculator;

    before("Deploy a pool contract and a destructable contract for force funding", async () => {
      [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      destructable = (await deployContract(user1, DestructableArtifact)) as DestructableContract;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await depositIndex.initialize(pool.address);
      const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await borrowingIndex.initialize(pool.address);

      await pool.initialize(
        ratesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
    });

    it("user1 funds destructable contract with 1ETH", async () => {
      await user1.sendTransaction({to: destructable.address, value: toWei("1.0")})
    });

    it("user2 and user3 make pool related actions", async () => {
      await pool.connect(user2).deposit({value: toWei("1.0")});
      await pool.connect(user3).borrow(toWei("0.7"));

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.3, 0.000001);
    });

    it("year passes, user 1 forcefully funds pool contract with 1 ETH", async () => {
      await time.increase(time.duration.years(1));

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.0938, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.3, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.09948787, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.13708721, 0.000001);

      await destructable.connect(user1).destruct(pool.address);

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.0938, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.3, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.099487871, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.13708721, 0.000001);
    });

    it("wait a year and check pool", async () => {
      await time.increase(time.duration.years(1));

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.18760001, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.3, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.10440044, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.1396867622, 0.000001);
    });
  });

  describe('Checking surplus', () => {
    let pool: Pool,
      owner: SignerWithAddress,
      user1: SignerWithAddress,
      user2: SignerWithAddress,
      user3: SignerWithAddress,
      ratesCalculator: VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await depositIndex.initialize(pool.address);
      const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await borrowingIndex.initialize(pool.address);

      await pool.initialize(
        ratesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
    });

    it("surplus for empty pool should be 0", async () => {
      let poolBalance = fromWei(await provider.getBalance(pool.address));
      let totalBorrowed = fromWei(await pool.totalBorrowed());
      let totalSupply = fromWei(await pool.totalSupply());
      const currentSurplus = poolBalance + totalBorrowed - totalSupply;
      expect(currentSurplus).to.be.closeTo(0, 0.00001);
    });

    it("surplus before borrowing should be 0", async () => {
      await pool.connect(user1).deposit({value: toWei("1")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1", "ether"));

      const currentSurplus = fromWei(await provider.getBalance(pool.address)) + fromWei(await pool.totalBorrowed()) - fromWei(await pool.totalSupply());
      expect(currentSurplus).to.be.closeTo(0, 0.00001);
    });

    it("surplus before accumulating rates should be 0", async () => {
      await pool.connect(user2).borrow(toWei("0.5"));
      expect(fromWei(await provider.getBalance(pool.address))).to.be.equal(0.5);

      const currentSurplus = fromWei(await provider.getBalance(pool.address)) + fromWei(await pool.totalBorrowed()) - fromWei(await pool.totalSupply());
      expect(currentSurplus).to.be.closeTo(0, 0.00001);
    });

    it("surplus after accumulating rates should be greater than zero", async () => {
      await time.increase(time.duration.years(2));

      const poolBalance = fromWei(await provider.getBalance(pool.address));

      const surplus = (await provider.getBalance(pool.address)).add(await pool.totalBorrowed()).sub(await pool.totalSupply());

      expect(surplus.toNumber()).to.be.greaterThanOrEqual(0);

      expect(poolBalance).to.be.closeTo(0.5, 0.00001);
    });

    it("surplus after multiple operations should be above 0", async () => {
      await time.increase(time.duration.months(6));

      await pool.connect(user2).borrow(toWei("0.1"));

      await time.increase(time.duration.years(0.25));
      await pool.connect(user1).deposit({value: toWei("0.3")});
      await pool.connect(user2).borrow(toWei("0.2"));

      await time.increase(time.duration.days(7));

      await pool.connect(user1).deposit({value: toWei("0.2")});

      await pool.connect(user1).withdraw(toWei("0.27"));

      await time.increase(time.duration.years(20));

      await pool.connect(user1).withdraw(toWei("0.07"));

      await time.increase(time.duration.years(20));

      const poolBalance = await provider.getBalance(pool.address);
      expect(fromWei(poolBalance)).to.be.closeTo(0.36, 0.00001);

      let surplus = poolBalance.add(await pool.totalBorrowed()).sub(await pool.totalSupply());
      expect(surplus.toNumber()).to.be.greaterThanOrEqual(0);
    });

    it("set new deposit rate offset", async () => {
      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(37.014824816, 0.000001);
      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(36.654824860, 0.000001);

      await ratesCalculator.setDepositRateOffset(toWei("10000000000"));
      expect(fromWei(await ratesCalculator.depositRateOffset())).to.equal(1e10);

      await time.increase(time.duration.years(1));

      expect(fromWei(await pool.balanceOf(user1.address))).to.be.closeTo(38.671367873, 0.000001);
      expect(fromWei(await pool.getBorrowed(user2.address))).to.be.closeTo(38.31136798, 0.000001);

      const poolBalance = await provider.getBalance(pool.address);
      expect(fromWei(poolBalance)).to.be.closeTo(0.36, 0.00001);

      let surplus = poolBalance.add(await pool.totalBorrowed()).sub(await pool.totalSupply());
      expect(surplus.toNumber()).to.be.greaterThanOrEqual(0);
    });
  });

  describe('Multiple surplus recover', () => {
    let pool: Pool,
        owner: SignerWithAddress,
        user1: SignerWithAddress,
        user2: SignerWithAddress,
        user3: SignerWithAddress,
        ratesCalculator: VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await depositIndex.initialize(pool.address);
      const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await borrowingIndex.initialize(pool.address);

      await pool.initialize(
          ratesCalculator.address,
          borrowersRegistry.address,
          depositIndex.address,
          borrowingIndex.address
      );
    });

    it("multiple recovering surplus should not make pool unbalanced", async () => {
      await pool.connect(user1).deposit({value: toWei("1")});
      await pool.connect(user2).borrow(toWei("0.5"));
      await pool.connect(user1).deposit({value: toWei("1")});

      await recoverSurplus();
      await time.increase(time.duration.months(3));

      await pool.connect(user1).deposit({value: toWei("0.1")});

      //time increase
      await recoverSurplus();
      await time.increase(time.duration.months(6));
      await recoverSurplus();
      await time.increase(time.duration.years(1));
      await recoverSurplus();
      await time.increase(time.duration.years(5));
      await recoverSurplus();

      //depositing, withdrawing, borrowing, repaying with time
      await pool.connect(user1).withdraw(toWei("0.1"));
      await recoverSurplus();
      await time.increase(time.duration.months(3));
      await pool.connect(user2).repay({value: toWei("0.1")});
      await recoverSurplus();
      await time.increase(time.duration.months(3));
      await pool.connect(user2).borrow(toWei("0.5"));
      await pool.connect(user1).deposit({value: toWei("1")});
      await time.increase(time.duration.years(5));
      await recoverSurplus();

      async function recoverSurplus() {
        const poolBalance = await provider.getBalance(pool.address);
        const currentSurplus = (await provider.getBalance(pool.address)).add(await pool.totalBorrowed()).sub(await pool.totalSupply());

        if (currentSurplus.gt(0)) {
          const maxAvailableSurplus = (poolBalance.lt(currentSurplus)) ? poolBalance : currentSurplus;

          await pool.connect(owner).recoverSurplus(maxAvailableSurplus.sub(BigNumber.from(10)), user3.address);
        } else {
          //surplus can sometimes be minimally lower than zero due to finite accuracy of arithmetic operations
          //minimal surplus of -100 Wei is acceptable
          expect(currentSurplus.toNumber()).to.be.lessThanOrEqual(100);
        }
      }
    });
  });


  describe('Pool utilisation greater than 1', () => {
    let pool: Pool,
      owner: SignerWithAddress,
      user1: SignerWithAddress,
      user2: SignerWithAddress,
      user3: SignerWithAddress,
      ratesCalculator: VariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
      [owner, user1, user2, user3] = await getFixedGasSigners(10000000);
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      const borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await depositIndex.initialize(pool.address);
      const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await borrowingIndex.initialize(pool.address);

      await pool.initialize(
        ratesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
    });

    it("keep rates at maximum when pool utilisation is above 1", async () => {
      await pool.connect(user1).deposit({value: toWei("1.2")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1.2", "ether"));

      await pool.connect(user2).borrow(toWei("1.09"));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.11", "ether"));

      await time.increase(time.duration.years(4));

      let poolUtilisation = await ratesCalculator.getPoolUtilisation(await pool.totalBorrowed(), await pool.totalSupply());
      expect(fromWei(poolUtilisation)).to.be.closeTo( 0.9662887, 0.000001);

      let poolBalance = fromWei(await provider.getBalance(pool.address));
      let depositUser1 = fromWei(await pool.balanceOf(user1.address));
      let borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

      expect(depositUser1).to.be.closeTo( 3.2630066666618665, 0.000001);
      expect(borrowedUser2).to.be.closeTo( 3.153006666666, 0.000001);

      await pool.connect(user2).repay({value: toWei("3")});

      await pool.connect(user1).withdraw(toWei("3"));

      await pool.connect(user2).borrow(toWei("0.09"));

      await pool.connect(user1).withdraw(toWei("0.0199999999999"));

      depositUser1 = fromWei(await pool.balanceOf(user1.address));

      expect(depositUser1).to.be.closeTo( 0.24300668787, 0.000001);

      expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);

      await time.increase(time.duration.years(1));

      poolBalance = fromWei(await provider.getBalance(pool.address));
      depositUser1 = fromWei(await pool.balanceOf(user1.address));
      borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

      expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);

      poolUtilisation = await ratesCalculator.getPoolUtilisation(await pool.totalBorrowed(), await pool.totalSupply());
      expect(fromWei(poolUtilisation)).to.be.above( 1);

      expect(fromWei(await pool.getDepositRate())).to.equal(0.749999999);
      expect(fromWei(await pool.getBorrowingRate())).to.equal(0.75);
    });

    it("recover surplus funds", async () => {
      const poolBalance = await provider.getBalance(pool.address);
      const totalBorrowed = await pool.totalBorrowed();
      const totalSupply = await pool.totalSupply();
      const depositRate = await pool.getDepositRate();
      const borrowingRate = await pool.getBorrowingRate();

      const currentSurplus = poolBalance.add(totalBorrowed).sub(totalSupply);
      const maxAvailableSurplus = (poolBalance.lt(currentSurplus)) ? poolBalance : currentSurplus;

      expect(maxAvailableSurplus.toNumber()).to.be.closeTo(100000, 1);
      expect(poolBalance.toNumber()).to.be.closeTo(100000, 1);
      expect(fromWei(totalSupply)).to.be.closeTo(0.4252617037, 0.00001);
      expect(fromWei(totalBorrowed)).to.be.closeTo(0.425261703, 0.00001);

      let receiverBalanceBeforeRecover = await provider.getBalance(user3.address);

      //diminished to account for roundings
      await pool.connect(owner).recoverSurplus(maxAvailableSurplus, user3.address);


      let receiverBalanceAfterRecover = await provider.getBalance(user3.address);

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0, 0.00001);
      expect(fromWei(receiverBalanceAfterRecover)).to.be.closeTo(fromWei(receiverBalanceBeforeRecover.add(maxAvailableSurplus)), 0.00001);
      await expect(pool.connect(owner).recoverSurplus(toWei("0.01"), user3.address)).to.be.revertedWith("Trying to recover more surplus funds than pool balance");

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(fromWei(totalSupply), 0.00001);
      expect(fromWei(await pool.getDepositRate())).to.equal(fromWei(depositRate));
      expect(fromWei(await pool.getBorrowingRate())).to.equal(fromWei(borrowingRate));
    });

    it("check condition of pool after a year", async () => {
      await time.increase(time.duration.years(1));

      expect(fromWei(await pool.getDepositRate())).to.equal(0.749999999);
      expect(fromWei(await pool.getBorrowingRate())).to.equal(0.75);

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0, 0.00001);
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0.607516737, 0.00001);
    });

    it("repay rest of loan and check pool condition", async () => {
      await pool.connect(user2).repay({value: await pool.getBorrowed(user2.address)});

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0.607516742, 0.00001);
      expect(fromWei(await pool.getDepositRate())).to.closeTo(0, 0.00001);
      expect(fromWei(await pool.getBorrowingRate())).to.closeTo(0.05, 0.00001);
    });

    it("withdraw rest of deposit and check pool condition", async () => {
      await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0, 0.00001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0, 0.00001);
      //there are some residual funds due to deposit rate offset
      expect((await provider.getBalance(pool.address)).toNumber()).to.be.closeTo(6706495482, 1);
    });

    it("recover surplus and check pool condition", async () => {
      const poolBalance = await provider.getBalance(pool.address);
      const totalBorrowed = await pool.totalBorrowed();
      const totalSupply = await pool.totalSupply();

      const currentSurplus = poolBalance.add(totalBorrowed).sub(totalSupply);
      const maxAvailableSurplus = (poolBalance.lt(currentSurplus)) ? poolBalance : currentSurplus;

      await pool.connect(owner).recoverSurplus(maxAvailableSurplus, user3.address);

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0, 0.00001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0, 0.00001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0, 0.00001);
    });
  });

  describe('Freeze pool', () => {
    let pool: Pool,
        originalPool: Pool,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        borrower: SignerWithAddress,
        admin: SignerWithAddress,
        variableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;

    before("should deploy a pool", async () => {
      [owner, depositor, borrower, admin] = await getFixedGasSigners(10000000);
      originalPool = (await deployContract(owner, PoolArtifact)) as Pool;

      pool = (await deployContract(owner, PoolArtifact)) as Pool;

      variableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
      const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
      const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await depositIndex.initialize(pool.address);
      const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
      await borrowingIndex.initialize(pool.address);

      await pool.initialize(
        variableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
    });


    it("should allow basic actions for a standard Rates calculator ", async () => {
      await pool.connect(depositor).deposit({value: toWei("1.2")});
      await pool.connect(depositor).withdraw(toWei("0.2"));
      await pool.connect(borrower).borrow(toWei("0.7"));
      await pool.connect(borrower).repay({value: toWei("0.2")});

      expect(fromWei(await pool.getBorrowed(borrower.address))).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.5, 0.000001);
    });


    it("should set a zero address calculator to freeze the pool", async () => {
      await pool.connect(owner).setRatesCalculator(ethers.constants.AddressZero)

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.5, 0.000001);
    });


    it("should revert basic actions for a freeze calculator ", async () => {
      await expect(pool.connect(depositor).deposit({value: toWei("1.0")})).to.be.revertedWith("Pool is frozen: cannot perform deposit, withdraw, borrow and repay operations");
      await expect(pool.connect(depositor).withdraw(toWei("0.2"))).to.be.revertedWith("Pool is frozen: cannot perform deposit, withdraw, borrow and repay operations");
      await expect(pool.connect(borrower).borrow(toWei("0.2"))).to.be.revertedWith("Pool is frozen: cannot perform deposit, withdraw, borrow and repay operations");
      await expect(pool.connect(borrower).repay({value: toWei("0.5")})).to.be.revertedWith("Pool is frozen: cannot perform deposit, withdraw, borrow and repay operations");

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.5, 0.000001);
    });


    it("should set back a standard calculator", async () => {
      await pool.connect(owner).setRatesCalculator(variableUtilisationRatesCalculator.address)
    });

    it("should allow basic actions for a standard calculator ", async () => {
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1, 0.000001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0.5, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.5, 0.000001);

      await expect(pool.connect(depositor).deposit({value: toWei("1.0")})).not.to.be.reverted;
      await expect(pool.connect(depositor).withdraw(toWei("0.2"))).not.to.be.reverted;
      await expect(pool.connect(borrower).borrow(toWei("0.2"))).not.to.be.reverted;
      await expect(pool.connect(borrower).repay({value: toWei("0.5")})).not.to.be.reverted;
    });
  });
});
