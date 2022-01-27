import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import DestructableArtifact from '../../artifacts/contracts/mock/DestructableContract.sol/DestructableContract.json';
import OpenBorrowersRegistryArtifact from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
  OpenBorrowersRegistry__factory,
  Pool,
  VariableUtilisationRatesCalculator,
  DestructableContract,
  OpenBorrowersRegistry, CompoundingIndex,
} from "../../typechain";

chai.use(solidity);

const {deployContract, provider} = waffle;
const ZERO = ethers.constants.AddressZero;

describe('Safety tests of pool', () => {
  describe('Intializing a pool', () => {
    let pool: Pool,
        owner: SignerWithAddress,
        nonContractAddress: string,
        ratesCalculator: VariableUtilisationRatesCalculator,
        borrowersRegistry: OpenBorrowersRegistry,
        depositIndex: CompoundingIndex,
        borrowingIndex: CompoundingIndex;

    before("Deploy a pool contract", async () => {
      [owner] = await getFixedGasSigners(10000000);
      nonContractAddress = '88a5c2d9919e46f883eb62f7b8dd9d0cc45bc290';
      ratesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact) as VariableUtilisationRatesCalculator);
      pool = (await deployContract(owner, PoolArtifact)) as Pool;
      borrowersRegistry = await (new OpenBorrowersRegistry__factory(owner).deploy());
      depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
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
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

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

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.098340055784504, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0.3, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.100158427, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.137445592, 0.000001);

      await destructable.connect(user1).destruct(pool.address);

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.098340055784504, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.3, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.100158427, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.13744559, 0.000001);
    });

    it("wait a year and check pool", async () => {
      await time.increase(time.duration.years(1));

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(1.206350878140707, 0.000001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.3, 0.000001);

      expect(fromWei(await pool.getDepositRate())).to.be.closeTo(0.106987879, 0.000001);
      expect(fromWei(await pool.getBorrowingRate())).to.be.closeTo(0.1410325196, 0.000001);
    });
  });

  describe('Surplus of 50% utilised pool', () => {
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
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

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

    it("take surplus after accumulating rates", async () => {
      await time.increase(time.duration.years(2));

      const totalSupply = fromWei(await pool.totalSupply());
      const totalBorrowed = fromWei(await pool.totalBorrowed());
      const poolBalance = fromWei(await provider.getBalance(pool.address));
      const currentSurplus = fromWei(await provider.getBalance(pool.address)) + fromWei(await pool.totalBorrowed()) - fromWei(await pool.totalSupply());
      expect(currentSurplus).to.be.closeTo(0.00676029, 0.00001);
      expect(poolBalance).to.be.closeTo(0.5, 0.00001);

      const maxAvailableSurplus = Math.min(poolBalance, currentSurplus);

      let receiverBalanceBeforeRecover = fromWei(await provider.getBalance(user3.address));

      await pool.connect(owner).recoverSurplus(toWei((maxAvailableSurplus - 0.000001).toString()), user3.address);

      let receiverBalanceAfterRecover = fromWei(await provider.getBalance(user3.address));

      expect(receiverBalanceAfterRecover).to.be.closeTo(receiverBalanceBeforeRecover + maxAvailableSurplus, 0.00001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(poolBalance - maxAvailableSurplus, 0.00001);
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(totalSupply, 0.00001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(totalBorrowed, 0.00001);
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
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

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



      await time.increase(time.duration.months(3));
      await recoverSurplus();
      await time.increase(time.duration.months(3));
      await recoverSurplus();
      await time.increase(time.duration.months(6));
      await recoverSurplus();
      await time.increase(time.duration.years(1));
      await recoverSurplus();
      await time.increase(time.duration.years(5));
      await recoverSurplus();

      await pool.connect(user2).borrow(toWei("0.3"));

      await time.increase(time.duration.months(3));
      await recoverSurplus();
      await time.increase(time.duration.years(2));
      await pool.connect(user2).repay({value: toWei("0.4")});
      await pool.connect(user1).withdraw(toWei("0.2"));
      await recoverSurplus();
      await time.increase(time.duration.years(1));
      await pool.connect(user2).repay({value: toWei("0.4")});
      await pool.connect(user1).withdraw(toWei("0.2"));
      await time.increase(time.duration.years(1));
      await recoverSurplus();

      async function recoverSurplus() {
        const poolBalance = fromWei(await provider.getBalance(pool.address));
        const currentSurplus = fromWei(await provider.getBalance(pool.address)) + fromWei(await pool.totalBorrowed()) - fromWei(await pool.totalSupply());
        const maxAvailableSurplus = Math.min(poolBalance, currentSurplus) - 1e-7; //subtracted 1e-7 because of accuracy issues when calculating surplus
        await pool.connect(owner).recoverSurplus(toWei((maxAvailableSurplus).toFixed(18)), user3.address);

        await checkPoolBalance()
      }

      async function checkPoolBalance() {
        let poolBalance = fromWei(await provider.getBalance(pool.address));
        let depositUser1 = fromWei(await pool.balanceOf(user1.address));
        let borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

        expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);
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
      const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
      const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

      await pool.initialize(
        ratesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address
      );
    });

    it("keep rates at maximum when pool utilisation is higher than 1", async () => {
      await pool.connect(user1).deposit({value: toWei("1.2")});
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("1.2", "ether"));

      await pool.connect(user2).borrow(toWei("1.09"));
      expect(await provider.getBalance(pool.address)).to.be.equal(toWei("0.11", "ether"));

      await time.increase(time.duration.years(4));

      const poolUtilisation = await ratesCalculator.getPoolUtilisation(await pool.totalBorrowed(), await pool.totalSupply());
      expect(poolUtilisation).to.be.above( 1);

      let poolBalance = fromWei(await provider.getBalance(pool.address));
      let depositUser1 = fromWei(await pool.balanceOf(user1.address));
      let borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

      expect(depositUser1).to.be.closeTo( 6.695889075746165, 0.000001);
      expect(borrowedUser2).to.be.closeTo( 7.234377734466623, 0.000001);

      await pool.connect(user2).repay({value: toWei("7")});

      await pool.connect(user1).withdraw(toWei("6.69"));

      depositUser1 = fromWei(await pool.balanceOf(user1.address));

      expect(depositUser1).to.be.closeTo( 0.005889258660823628, 0.000001);

      expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);

      await time.increase(time.duration.years(1));

      poolBalance = fromWei(await provider.getBalance(pool.address));
      depositUser1 = fromWei(await pool.balanceOf(user1.address));
      borrowedUser2 = fromWei(await pool.getBorrowed(user2.address));

      expect(depositUser1).to.be.below(borrowedUser2 + poolBalance);
      expect(fromWei(await pool.getDepositRate())).to.equal(0.75);
      expect(fromWei(await pool.getBorrowingRate())).to.equal(0.75);
    });

    it("recover surplus funds", async () => {
      const poolBalance = fromWei(await provider.getBalance(pool.address));
      const totalBorrowed = fromWei(await pool.totalBorrowed());
      const totalSupply = fromWei(await pool.totalSupply());
      const depositRate = fromWei(await pool.getDepositRate());
      const borrowingRate = fromWei(await pool.getBorrowingRate());

      const currentSurplus = poolBalance + totalBorrowed - totalSupply;
      const maxAvailableSurplus = Math.min(poolBalance, currentSurplus);

      expect(maxAvailableSurplus).to.be.closeTo(0.42, 0.00001);
      expect(poolBalance).to.be.closeTo(0.42, 0.00001);
      expect(totalSupply).to.be.closeTo(0.012467367382828578, 0.00001);
      expect(totalBorrowed).to.be.closeTo(0.496177, 0.00001);
      expect(maxAvailableSurplus).to.be.closeTo(0.42, 0.00001);

      let receiverBalanceBeforeRecover = fromWei(await provider.getBalance(user3.address));

      //diminished to account for roundings
      await pool.connect(owner).recoverSurplus(toWei((maxAvailableSurplus - 0.000001).toString()), user3.address);

      let receiverBalanceAfterRecover = fromWei(await provider.getBalance(user3.address));

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0, 0.00001);
      expect(receiverBalanceAfterRecover).to.be.closeTo(receiverBalanceBeforeRecover + maxAvailableSurplus, 0.00001);
      await expect(pool.connect(owner).recoverSurplus(toWei("0.01"), user3.address)).to.be.revertedWith("Trying to recover more surplus funds than pool balance");

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(totalSupply, 0.00001);
      expect(fromWei(await pool.getDepositRate())).to.equal(depositRate);
      expect(fromWei(await pool.getBorrowingRate())).to.equal(borrowingRate);
    });

    it("check condition of pool after a year", async () => {
      await time.increase(time.duration.years(1));

      expect(fromWei(await pool.getDepositRate())).to.equal(0.75);
      expect(fromWei(await pool.getBorrowingRate())).to.equal(0.75);

      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(0, 0.00001);
      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0.026393417976572575, 0.00001);
    });

    it("repay rest of loan and check pool condition", async () => {
      await pool.connect(user2).repay({value: await pool.getBorrowed(user2.address)});

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0.026393417976572575, 0.00001);
      expect(fromWei(await pool.getDepositRate())).to.closeTo(0, 0.00001);
      expect(fromWei(await pool.getBorrowingRate())).to.closeTo(0.05, 0.00001);
    });

    it("withdraw rest of deposit and check pool condition", async () => {
      await pool.connect(user1).withdraw(await pool.balanceOf(user1.address));

      expect(fromWei(await pool.totalSupply())).to.be.closeTo(0, 0.00001);
      expect(fromWei(await pool.totalBorrowed())).to.be.closeTo(0, 0.00001);
      expect(fromWei(await provider.getBalance(pool.address))).to.be.closeTo(1.02401623, 0.00001);
    });

    it("recover surplus and check pool condition", async () => {
      const poolBalance = fromWei(await provider.getBalance(pool.address));
      const totalBorrowed = fromWei(await pool.totalBorrowed());
      const totalSupply = fromWei(await pool.totalSupply());

      const currentSurplus = poolBalance + totalBorrowed - totalSupply;
      await pool.connect(owner).recoverSurplus(toWei((currentSurplus - 0.000001).toString()), user3.address);

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
        const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
        const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

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
