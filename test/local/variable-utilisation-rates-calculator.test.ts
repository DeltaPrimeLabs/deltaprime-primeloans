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
const TEST_TABLE =  [
  [0,	          0.05,	          0],
  [0.01,	      0.0512,	        0.000512],
  [0.00000001,	0.0500000012,	  0.0000000005],
  [0.1,	        0.062,	        0.0062],
  [0.15,	      0.068,	        0.0102],
  [0.2,	        0.074,	        0.0148],
  [0.3,	        0.086,	        0.0258],
  [0.4,	        0.098,	        0.0392],
  [0.5,	        0.11,	          0.055],
  [0.6,	        0.122,	        0.0732],
  [0.7,	        0.134,	        0.0938],
  [0.79,	      0.1448,	        0.114392],
  [0.799999,	  0.14599988,	    0.116799758],
  [0.8,	        0.146,	        0.1168],
  [0.800001,	  0.14600302,	    0.116802562],
  [0.81,	      0.1762,	        0.142722],
  [0.825,	      0.2215,	        0.1827375],
  [0.85,	      0.297,	        0.25245],
  [0.875,	      0.3725,	        0.3259375],
  [0.9,	        0.448,	        0.4032],
  [0.925,	      0.5235,	        0.4842375],
  [0.95,	      0.599,	        0.56905],
  [0.975,	      0.6745,	        0.6576375],
  [0.999,	      0.74698,	      0.74623302],
  [1,	          0.75,	          0.75],
  [1.1,	        0.75,	          0.75]
]

describe('VariableUtilisationRatesCalculator', () => {
  let sut: VariableUtilisationRatesCalculator,
    owner: SignerWithAddress,
    nonOwner: SignerWithAddress;

  beforeEach(async () => {
    [owner, nonOwner] = await getFixedGasSigners(10000000);
    sut = (await deployContract(
      owner,
      VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
  });

  const deposits = 100;

  TEST_TABLE.forEach(
    testCase => {
      const percentageUtilisation = testCase[0] * 100;
      it(`should calculate for ${percentageUtilisation}% utilisation`, async function () {
        let loansInWei = toWei((testCase[0] * deposits).toString());
        let depositsInWei = toWei(deposits.toString());

        const borrowingRate = fromWei(await sut.calculateBorrowingRate(loansInWei, depositsInWei));
        const depositRate = fromWei(await sut.calculateDepositRate(loansInWei, depositsInWei));

        expect(borrowingRate).to.be.closeTo(testCase[1], 0.0000000001);
        expect(depositRate).to.be.closeTo(testCase[2], 0.0000000001);
      });
    }
  )
});
