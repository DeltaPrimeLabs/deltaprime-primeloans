import {waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import ERC20PoolArtifact from '../../artifacts/contracts/ERC20Pool.sol/ERC20Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import OpenBorrowersRegistryArtifact
  from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
  LinearIndex,
  OpenBorrowersRegistry,
  ERC20Pool,
  VariableUtilisationRatesCalculator,
  MockToken
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;

//results: https://docs.google.com/spreadsheets/d/1foJvQ03Mp3jXil4OyB6UyKeO4P7ho7aXu9WA-TYxeB0/edit#gid=445998878
const TEST_ACTIONS = [
  {
    id:                 1,
    delay:              0,
    deposit1:           6,
    expectedDeposited:  6,
    expectedBorrowed:   0,
    expectedDepositAPR: 0,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 2,
    delay:              0,
    deposit2:           4,
    expectedDeposited:  10,
    expectedBorrowed:   0,
    expectedDepositAPR: 0,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 3,
    borrow1:            3,
    expectedDeposited:  10,
    expectedBorrowed:   3,
    expectedDepositAPR: 0.008999991,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 4,
    borrow2:            2,
    expectedDeposited:  10,
    expectedBorrowed:   5,
    expectedDepositAPR: 0.014999985,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 5,
    delay:              31536000,
    expectedDeposited:  10.15,
    expectedBorrowed:   5.15,
    expectedDepositAPR: 0.01522167488,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 6,
    repay1:             2,
    expectedDeposited:  10.14999985,
    expectedBorrowed:   3.15,
    expectedDepositAPR: 0.009310335655,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 7,
    delay:              31536000,
    expectedDeposited:  10.24449976,
    expectedBorrowed:   3.2445,
    expectedDepositAPR: 0.009501186489,
    expectedBorrowAPR:  0.03,
  },
  {
    id:                 8,
    borrow1:            3,
    expectedDeposited:  10.24449976,
    expectedBorrowed:   6.2445,
    expectedDepositAPR: 0.02090497116,
    expectedBorrowAPR:  0.03429597023,
  },
  {
    id:                 9,
    delay:              31536000,
    expectedDeposited:  10.45866073,
    expectedBorrowed:   6.458661186,
    expectedDepositAPR: 0.02340101888,
    expectedBorrowAPR:  0.03789385367,
  },
  {
    id:                 10,
    withdraw1:          1,
    expectedDeposited:  9.458660727,
    expectedBorrowed:   6.458661186,
    expectedDepositAPR: 0.04593647177,
    expectedBorrowAPR:  0.06727368467,
  },
  {
    id:                 11,
    delay:              31536000,
    expectedDeposited:  9.893158229,
    expectedBorrowed:   6.893159122,
    expectedDepositAPR: 0.05124115854,
    expectedBorrowAPR:  0.07354209982,
  },
  {
    id:                 12,
    borrow2:            1,
    expectedDeposited:  9.893158229,
    expectedBorrowed:   7.893159122,
    expectedDepositAPR: 0.09496528964,
    expectedBorrowAPR:  0.1190280801,
  },
  {
    id:                 13,
    delay:              31536000,
    expectedDeposited:  10.83266487,
    expectedBorrowed:   8.832666698,
    expectedDepositAPR: 0.1373300929,
    expectedBorrowAPR:  0.1684261855,
  }
]
describe('Pool testing suite with accumulating interest', () => {
  let sut: ERC20Pool,
      owner: SignerWithAddress,
      depositor1: SignerWithAddress,
      depositor2: SignerWithAddress,
      borrower1: SignerWithAddress,
      borrower2: SignerWithAddress,
      mockToken: Contract,
      VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator;
  
  before("Deploy Pool contract", async () => {
    [owner, depositor1, depositor2, borrower1, borrower2] = await getFixedGasSigners(10000000);
    sut = (await deployContract(owner, ERC20PoolArtifact)) as ERC20Pool;

    VariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
    const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;

    let depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
    await depositIndex.initialize(sut.address);
    let borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
    await borrowingIndex.initialize(sut.address);

    mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address]])) as MockToken;

    await sut.initialize(
        VariableUtilisationRatesCalculator.address,
        borrowersRegistry.address,
        depositIndex.address,
        borrowingIndex.address,
        mockToken.address
    );
  });

  describe('Should perform test suite', () =>

    TEST_ACTIONS.forEach(
      (action, i) => {
        it(`should perform action ${action.id}`, async () => {

          if (action.delay) {
            await time.increase(action.delay);
          }

          if (action.deposit1) {
            await mockToken.connect(depositor1).approve(sut.address, toWei(action.deposit1.toString()));
            await sut.connect(depositor1).deposit(toWei(action.deposit1.toString()));
          }

          if (action.deposit2) {
            await mockToken.connect(depositor2).approve(sut.address, toWei(action.deposit2.toString()));
            await sut.connect(depositor2).deposit(toWei(action.deposit2.toString()));
          }

          if (action.withdraw1) {
            await sut.connect(depositor1).withdraw(toWei(action.withdraw1.toString()));
          }

          // if (action.withdraw2) {
          //   await sut.connect(depositor2).withdraw(toWei(action.withdraw2.toString()));
          // }

          if (action.borrow1) {
            await sut.connect(borrower1).borrow(toWei(action.borrow1.toString()));
          }

          if (action.borrow2) {
            await sut.connect(borrower2).borrow(toWei(action.borrow2.toString()));
          }

          if (action.repay1) {
            await mockToken.connect(borrower1).approve(sut.address, toWei(action.repay1.toString()));
            await sut.connect(borrower1).repay(toWei(action.repay1.toString()));
          }

          // if (action.repay2) {
          //   await sut.connect(borrower2).repay(toWei(action.repay2.toString()));
          // }

          let deposited = fromWei(await sut.totalSupply());
          expect(deposited).to.be.closeTo(action.expectedDeposited, 0.000001);

          let borrowed = fromWei(await sut.totalBorrowed());
          expect(borrowed).to.be.closeTo(action.expectedBorrowed, 0.000001);

          let depositRate = fromWei(await sut.getDepositRate());
          expect(depositRate).to.be.closeTo(action.expectedDepositAPR, 0.000001);

          let borrowingRate = fromWei(await sut.getBorrowingRate());
          expect(borrowingRate).to.be.closeTo(action.expectedBorrowAPR, 0.000001);
        }
      );
    })
  );
});