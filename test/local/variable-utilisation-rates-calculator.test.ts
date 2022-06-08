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
  [0.01,0.03,0.0002999997],
  [0.00000001,0.03,0.0000000002999997],
  [0.1,0.03,0.002999997],
  [0.15,0.03,0.0044999955],
  [0.2,0.03,0.005999994],
  [0.3,0.03,0.008999991],
  [0.4,0.03,0.011999988],
  [0.5,0.03,0.014999985],
  [0.52,0.03,0.0155999844],
  [0.599999,0.03,0.01799995200003],
  [0.6,0.03,0.017999982],
  [0.6000001,0.030000045,0.0180000119999745],
  [0.7,0.075,0.0524999475],
  [0.79,0.1155,0.091244908755],
  [0.8,0.12,0.095999904],
  [0.799999,0.11999955,0.09599942400093],
  [0.8057,0.137955,0.111150232349656],
  [0.800001,0.12000315,0.0960025440005097],
  [0.825,0.19875,0.16396858603125],
  [0.85,0.2775,0.235874764125],
  [0.875,0.35625,0.31171843828125],
  [0.9,0.435,0.3914996085],
  [0.925,0.51375,0.47521827478125],
  [0.95,0.5925,0.562874437125],
  [0.975,0.67125,0.65446809553125],
  [0.999,0.74685,0.74610240389685],
  [1,0.75,0.74999925],
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
