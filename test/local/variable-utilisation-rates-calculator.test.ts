import {ethers, waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
  from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import {VariableUtilisationRatesCalculator} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

// From left: pool utilisation, expected Borrowing Rate, expected Deposit Rate
const TEST_TABLE_RATES =  [
  [0,0.03,0],
  [0.01,0.0312,0.00031044],
  [0.00000001,0.0300000012,0.00000000029850001194],
  [0.1,0.042,0.004179],
  [0.15,0.048,0.007164],
  [0.2,0.054,0.010746],
  [0.3,0.066,0.019701],
  [0.4,0.078,0.031044],
  [0.5,0.09,0.044775],
  [0.52,0.0924,0.04780776],
  [0.6,0.102,0.060894],
  [0.7,0.114,0.079401],
  [0.79,0.1248,0.09809904],
  [0.8,0.126,0.100296],
  [0.799999,0.12599988,0.100295779110119],
  [0.81,0.1572,0.12669534],
  [0.800001,0.12600312,0.100298608893104],
  [0.825,0.204,0.1674585],
  [0.85,0.282,0.2385015],
  [0.875,0.36,0.313425],
  [0.9,0.438,0.392229],
  [0.925,0.516,0.4749135],
  [0.95,0.594,0.5614785],
  [0.975,0.672,0.651924],
  [0.999,0.74688,0.7424024544],
  [1,0.75,0.74625],
]
// From left: totalLoans, totalDeposits, expected pool utilisation
const POOL_UTILISATION =  [
  [1,	          10,	                    0.1],
  [1,	          100000,	                0.00001],
  [0.001,	      100000000,	            0.00000000001],
  [1.1,	          1,	                    1.1],
  [1e-5,	      1e5,	                    1e-10],
  // maximum test accuracy
  [1e-5,	      1e7,	                    1e-12],
  // above maximum test accuracy
  [1e-5,	      1e8,	                    0],
  [4321.432,	  5710432.34217984,	        0.0007567609142]
]

describe('VariableUtilisationRatesCalculator', () => {
  let sut: VariableUtilisationRatesCalculator,
    owner: SignerWithAddress,
    nonOwner: SignerWithAddress,
    deposits: number;

  before(async () => {
    [owner, nonOwner] = await getFixedGasSigners(10000000);
    sut = (await deployContract(
      owner,
      VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;

    deposits = 100;
  });

  TEST_TABLE_RATES.forEach(
    testCase => {
      const percentageUtilisation = testCase[0] * 100;
      it(`should calculate rates for ${percentageUtilisation}% utilisation`, async function () {
        let loansInWei = toWei((testCase[0] * deposits).toFixed(12).toString());
        let depositsInWei = toWei(deposits.toString());

        const borrowingRate = fromWei(await sut.calculateBorrowingRate(loansInWei, depositsInWei));
        const depositRate = fromWei(await sut.calculateDepositRate(loansInWei, depositsInWei));

        expect(borrowingRate).to.be.closeTo(testCase[1], 1e-11);
        expect(depositRate).to.be.closeTo(testCase[2], 1e-11);
      });
    }
  )

  POOL_UTILISATION.forEach(
      testCase => {
        it(`should calculate pool utilisation for ${testCase[0]} totalLoans and ${testCase[1]} totalDeposits`, async function () {
          expect(fromWei(await sut.getPoolUtilisation(
              toWei(testCase[0].toFixed(18).toString()),
              toWei(testCase[1].toFixed(18).toString()))))
            .to.be.closeTo(testCase[2], 1e-13);
        });
      }
  )
});
