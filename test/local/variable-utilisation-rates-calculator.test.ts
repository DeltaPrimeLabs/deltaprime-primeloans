import {waffle} from 'hardhat'
import chai from 'chai'
import {solidity} from "ethereum-waffle";

import AvalancheWavaxVariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/deployment/avalanche/WavaxVariableUtilisationRatesCalculator.sol/WavaxVariableUtilisationRatesCalculator.json';
import AvalancheUsdcVariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/deployment/avalanche/UsdcVariableUtilisationRatesCalculator.sol/UsdcVariableUtilisationRatesCalculator.json';
import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import {
    MockVariableUtilisationRatesCalculator,
    UsdcVariableUtilisationRatesCalculator,
    WavaxVariableUtilisationRatesCalculator
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {BigNumber, Contract} from "ethers";

chai.use(solidity);

const {deployContract} = waffle;
const {expect} = chai;

// From left: pool utilisation, expected Borrowing Rate, expected Deposit Rate
const MOCK_TEST_TABLE_RATES = [
    [0, 0.03, 0],
    [0.01, 0.03, 0.0002999997],
    [0.00000001, 0.03, 0.0000000002999997],
    [0.1, 0.03, 0.002999997],
    [0.15, 0.03, 0.0044999955],
    [0.2, 0.03, 0.005999994],
    [0.3, 0.03, 0.008999991],
    [0.4, 0.03, 0.011999988],
    [0.5, 0.03, 0.014999985],
    [0.52, 0.03, 0.0155999844],
    [0.599999, 0.03, 0.01799995200003],
    [0.6, 0.03, 0.017999982],
    [0.6000001, 0.030000045, 0.0180000119999745],
    [0.7, 0.075, 0.0524999475],
    [0.79, 0.1155, 0.091244908755],
    [0.8, 0.12, 0.095999904],
    [0.799999, 0.11999955, 0.09599942400093],
    [0.8057, 0.137955, 0.111150232349656],
    [0.800001, 0.12000315, 0.0960025440005097],
    [0.825, 0.19875, 0.16396858603125],
    [0.85, 0.2775, 0.235874764125],
    [0.875, 0.35625, 0.31171843828125],
    [0.9, 0.435, 0.3914996085],
    [0.925, 0.51375, 0.47521827478125],
    [0.95, 0.5925, 0.562874437125],
    [0.975, 0.67125, 0.65446809553125],
    [0.999, 0.74685, 0.74610240389685],
    [1, 0.75, 0.74999925],
]
const AVALANCHE_WAVAX_TEST_TABLE_RATES = [
    [0,0,0],
    [0.01,0.00166666666666667,0.000015],
    [0.00000001,0.00000000166666666666667,1.5E-17],
    [0.1,0.0166666666666667,0.0015],
    [0.15,0.025,0.003375],
    [0.2,0.0333333333333333,0.006],
    [0.3,0.05,0.0135],
    [0.4,0.0666666666666667,0.024],
    [0.5,0.0833333333333333,0.0375],
    [0.52,0.0866666666666667,0.04056],
    [0.599999,0.0999998333333333,0.05399982000015],
    [0.6,0.1,0.054],
    [0.6000001,0.10000005,0.0540000360000046],
    [0.7,0.15,0.0945],
    [0.79,0.195,0.138645],
    [0.8,0.2,0.144],
    [0.799999,0.1999995,0.14399946000045],
    [0.8057,0.2057,0.149159241],
    [0.800001,0.200001,0.1440009000009],
    [0.825,0.225,0.1670625],
    [0.85,0.25,0.19125],
    [0.875,0.275,0.2165625],
    [0.9,0.300000000000001,0.243000000000001],
    [0.925,1.,0.832500000000003],
    [0.95,1.7,1.4535],
    [0.975,2.4,2.106],
    [0.999,3.072,2.7620352],
    [1,3.1,2.79],
]

const AVALANCHE_USDC_TEST_TABLE_RATES = [
    [0,0,0],
    [0.01,0.00416666666666667,0.0000375],
    [0.00000001,0.00000000416666666666667,3.75E-17],
    [0.1,0.0416666666666667,0.00375],
    [0.15,0.0625,0.0084375],
    [0.2,0.0833333333333333,0.015],
    [0.3,0.125,0.03375],
    [0.4,0.166666666666667,0.06],
    [0.5,0.208333333333333,0.09375],
    [0.52,0.216666666666667,0.1014],
    [0.599999,0.249999583333333,0.134999550000375],
    [0.6,0.25,0.135],
    [0.68,0.35,0.2142],
    [0.7,0.375,0.23625],
    [0.725,0.40625,0.265078125],
    [0.8,0.5,0.36],
    [0.799999,0.49999875,0.359998650001125],
    [0.8057,0.50855,0.3687648615],
    [0.800001,0.5000015,0.36000153000135],
    [0.825,0.5375,0.39909375],
    [0.85,0.575,0.439875],
    [0.875,0.612500000000001,0.48234375],
    [0.9,0.65,0.5265],
    [0.925,0.862499999999999,0.718031249999999],
    [0.95,1.075,0.919124999999999],
    [0.975,1.2875,1.12978125],
    [0.999,1.4915,1.34100765],
    [1,1.5,1.35],
]
// From left: totalLoans, totalDeposits, expected pool utilisation
const POOL_UTILISATION = [
    [1, 10, 0.1],
    [1, 100000, 0.00001],
    [0.001, 100000000, 0.00000000001],
    [1.1, 1, 1.1],
    [1e-5, 1e5, 1e-10],
    // maximum test accuracy
    [1e-5, 1e7, 1e-12],
    // above maximum test accuracy
    [1e-5, 1e8, 0],
    [4321.432, 5710432.34217984, 0.0007567609142]
]

const AVALANCHE_WAVAX_SPREAD = toWei('0.1');
const AVALANCHE_USDC_SPREAD = toWei('0.1');

describe('VariableUtilisationRatesCalculator', () => {
    let mockCalculator: MockVariableUtilisationRatesCalculator,
        avalancheWavaxCalculator: WavaxVariableUtilisationRatesCalculator,
        avalancheUsdcCalculator: UsdcVariableUtilisationRatesCalculator,
        owner: SignerWithAddress,
        nonOwner: SignerWithAddress,
        deposits: number;

    before(async () => {
        [owner, nonOwner] = await getFixedGasSigners(10000000);
        mockCalculator = (await deployContract(
            owner,
            VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;

        avalancheWavaxCalculator = (await deployContract(
            owner,
            AvalancheWavaxVariableUtilisationRatesCalculatorArtifact)) as WavaxVariableUtilisationRatesCalculator;

        await avalancheWavaxCalculator.setSpread(AVALANCHE_WAVAX_SPREAD);

        avalancheUsdcCalculator = (await deployContract(
            owner,
            AvalancheUsdcVariableUtilisationRatesCalculatorArtifact)) as UsdcVariableUtilisationRatesCalculator;

        await avalancheUsdcCalculator.setSpread(AVALANCHE_USDC_SPREAD);

        deposits = 100;
    });

    it('Test calculators', async () => {
        POOL_UTILISATION.forEach(
            testCase => {
                it(`should calculate pool utilisation for ${testCase[0]} totalLoans and ${testCase[1]} totalDeposits`, async function () {
                    expect(fromWei(await mockCalculator.getPoolUtilisation(
                        toWei(testCase[0].toFixed(18).toString()),
                        toWei(testCase[1].toFixed(18).toString()))))
                        .to.be.closeTo(testCase[2], 1e-13);
                });
            }
        );

        console.log('----MOCK----')
        await testRates(MOCK_TEST_TABLE_RATES, mockCalculator);
        console.log('----AVAX----')
        await testRates(AVALANCHE_WAVAX_TEST_TABLE_RATES, avalancheWavaxCalculator);
        console.log('----USDC----')
        await testRates(AVALANCHE_USDC_TEST_TABLE_RATES, avalancheUsdcCalculator);

        async function testRates(testTable: Array<any>, ratesContract: Contract) {
            for (const testCase of testTable) {
                const percentageUtilisation = testCase[0] * 100;
                console.log(`should calculate rates for ${percentageUtilisation}% utilisation`);
                let loansInWei = toWei((testCase[0] * deposits).toFixed(12).toString());
                let depositsInWei = toWei(deposits.toString());

                const borrowingRate = fromWei(await ratesContract.calculateBorrowingRate(loansInWei, depositsInWei));
                const depositRate = fromWei(await ratesContract.calculateDepositRate(loansInWei, depositsInWei));

                console.log('borrowing Rate: ', borrowingRate)
                expect(borrowingRate).to.be.closeTo(testCase[1], 1e-11);
                expect(depositRate).to.be.closeTo(testCase[2], 1e-11);
            }
        }
    });
});
