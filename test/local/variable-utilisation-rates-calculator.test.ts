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
  [0.01,0.03,0.0002985],
  [0.00000001,0.03,0.0000000002985],
  [0.1,0.03,0.002985],
  [0.15,0.03,0.0044775],
  [0.2,0.03,0.00597],
  [0.3,0.03,0.008955],
  [0.4,0.03,0.01194],
  [0.5,0.03,0.014925],
  [0.52,0.03,0.015522],
  [0.599999,0.03,0.01790997015],
  [0.6,0.03,0.01791],
  [0.6000001,0.030000045,0.0179100298500045],
  [0.7,0.075,0.0522375],
  [0.79,0.1155,0.090788775],
  [0.8,0.12,0.09552],
  [0.799999,0.11999955,0.0955195224004478],
  [0.8057,0.137955,0.1105945917825],
  [0.800001,0.12000315,0.095522626803134],
  [0.825,0.19875,0.16314890625],
  [0.85,0.2775,0.234695625],
  [0.875,0.35625,0.31016015625],
  [0.9,0.435,0.3895425],
  [0.925,0.51375,0.47284265625],
  [0.95,0.5925,0.560060625],
  [0.975,0.67125,0.65119640625],
  [0.999,0.74685,0.74237263425],
  [1,0.75,0.74625],
  [0.490354080660527,0.03,0.0146370693077167]
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
