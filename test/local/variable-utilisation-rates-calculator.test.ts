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
import {Contract} from "ethers";

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
    [0.01,0.00125,0.0000124999875],
    [0.00000001,0.00000000125,1.24999875E-17],
    [0.1,0.0125,0.00124999875],
    [0.15,0.01875,0.0028124971875],
    [0.2,0.025,0.004999995],
    [0.3,0.0375,0.01124998875],
    [0.4,0.05,0.01999998],
    [0.5,0.07,0.034999965],
    [0.52,0.074,0.03847996152],
    [0.599999,0.0899998,0.05399973600041],
    [0.6,0.09,0.053999946],
    [0.6000001,0.09000002,0.053999966999981],
    [0.7,0.11,0.076999923],
    [0.79,0.128,0.10111989888],
    [0.8,0.13,0.103999896],
    [0.799999,0.1299998,0.10399960600049],
    [0.8057,0.13399,0.107955635044257],
    [0.800001,0.1300007,0.10400058600001],
    [0.825,0.1475,0.1216873783125],
    [0.85,0.165,0.14024985975],
    [0.875,0.1825,0.1596873403125],
    [0.9,0.200000000000003,0.179999820000003],
    [0.925,0.925000000000001,0.855624144375001],
    [0.95,1.65,1.5674984325],
    [0.975,2.375,2.315622684375],
    [0.999,3.071,3.067925932071],
    [1,3.1,3.0999969],
]

const AVALANCHE_USDC_TEST_TABLE_RATES = [
    [0,0,0],
    [0.01,0.0005,0.000004999995],
    [0.00000001,0.0000000005,4.999995E-18],
    [0.1,0.005,0.0004999995],
    [0.15,0.0075,0.001124998875],
    [0.2,0.01,0.001999998],
    [0.3,0.015,0.0044999955],
    [0.4,0.02,0.007999992],
    [0.5,0.025,0.0124999875],
    [0.52,0.026,0.01351998648],
    [0.599999,0.02999995,0.01799992200011],
    [0.6,0.03,0.017999982],
    [0.6000001,0.03000002,0.017999996999987],
    [0.7,0.05,0.034999965],
    [0.79,0.068,0.05371994628],
    [0.8,0.07,0.055999944],
    [0.799999,0.0699998,0.05599971400043],
    [0.8057,0.07285,0.058695186304755],
    [0.800001,0.0700005,0.05600041400003],
    [0.825,0.0825,0.0680624319375],
    [0.85,0.095,0.08074991925],
    [0.875,0.1075,0.0940624059375],
    [0.9,0.12,0.107999892],
    [0.925,0.24,0.221999778],
    [0.95,0.359999999999999,0.341999658],
    [0.975,0.48,0.467999532],
    [0.999,0.595199999999999,0.594604205395199],
    [1,0.6,0.5999994],
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

        avalancheUsdcCalculator = (await deployContract(
            owner,
            AvalancheUsdcVariableUtilisationRatesCalculatorArtifact)) as UsdcVariableUtilisationRatesCalculator;

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

        await testRates(MOCK_TEST_TABLE_RATES, mockCalculator);
        await testRates(AVALANCHE_WAVAX_TEST_TABLE_RATES, avalancheWavaxCalculator);
        await testRates(AVALANCHE_USDC_TEST_TABLE_RATES, avalancheUsdcCalculator);

        async function testRates(testTable: Array<any>, ratesContract: Contract) {
            for (const testCase of testTable) {
                const percentageUtilisation = testCase[0] * 100;
                console.log(`should calculate rates for ${percentageUtilisation}% utilisation`);
                let loansInWei = toWei((testCase[0] * deposits).toFixed(12).toString());
                let depositsInWei = toWei(deposits.toString());

                const borrowingRate = fromWei(await ratesContract.calculateBorrowingRate(loansInWei, depositsInWei));
                const depositRate = fromWei(await ratesContract.calculateDepositRate(loansInWei, depositsInWei));

                expect(borrowingRate).to.be.closeTo(testCase[1], 1e-11);
                expect(depositRate).to.be.closeTo(testCase[2], 1e-11);
            }
        }
    });
});
