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
  [0,	          0.05,	            0],
  [0.01,	      0.0512,	        0.000511999],
  [0.00000001,	  0.0500000012,	    0.0000000005],
  [1e-9,	      0.05000000012,	5e-11],
  [0.1,	          0.062,	        0.006199999],
  [0.15,	      0.068,	        0.010199999],
  [0.2,	          0.074,	        0.014799999],
  [0.3,	          0.086,	        0.025799999],
  [0.4,	          0.098,	        0.039199999],
  [0.5,	          0.11,	            0.054999999],
  [0.6,	          0.122,	        0.073199999],
  [0.7,	          0.134,	        0.093799999],
  [0.79,	      0.1448,	        0.114391999],
  [0.799999,	  0.14599988,	    0.116799757],
  [0.8,	          0.146,	        0.116799999],
  [0.800001,	  0.14600302,	    0.116802561],
  [0.81,	      0.1762,	        0.142721999],
  [0.825,	      0.2215,	        0.182737499],
  [0.85,	      0.297,	        0.252449999],
  [0.875,	      0.3725,	        0.325937499],
  [0.9,	          0.448,	        0.403199999],
  [0.925,	      0.5235,	        0.484237499],
  [0.95,	      0.599,	        0.569049999],
  [0.975,	      0.6745,	        0.657637499],
  [0.999,	      0.74698,	        0.746233019],
  [1,	          0.75,	            0.749999999],
  [1.1,	          0.75,	            0.749999999]
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
