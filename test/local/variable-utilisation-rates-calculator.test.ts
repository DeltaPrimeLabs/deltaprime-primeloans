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
    [0.01,0.00141666666666667,0.0000141666525],
    [0.00000001,0.00000000141666666666667,1.41666525E-17],
    [0.1,0.0141666666666667,0.00141666525],
    [0.15,0.02125,0.0031874968125],
    [0.2,0.0283333333333333,0.005666661],
    [0.3,0.0425,0.01274998725],
    [0.4,0.0566666666666667,0.022666644],
    [0.5,0.0708333333333334,0.03541663125],
    [0.52,0.0736666666666667,0.03830662836],
    [0.599999,0.0849998583333334,0.0509997790003117],
    [0.6,0.085,0.050999949],
    [0.4586,0.0649683333333334,0.029794447872189],
    [0.7,0.1085,0.07594992405],
    [0.79,0.12965,0.1024233975765],
    [0.8,0.132,0.1055998944],
    [0.799999,0.131999765,0.105599574400555],
    [0.7982,0.131577,0.105024656375239],
    [0.8057,0.137586,0.11085292934696],
    [0.800001,0.13200098,0.105600810400064],
    [0.825,0.1565,0.1291123708875],
    [0.85,0.181,0.15384984615],
    [0.875,0.2055,0.1798123201875],
    [0.9,0.23,0.206999793],
    [0.925,0.947500000000002,0.876436623562502],
    [0.95,1.665,1.58174841825],
    [0.975,2.3825,2.3229351770625],
    [0.999,3.0713,3.0682256317713],
    [1,3.1,3.0999969],
]

const AVALANCHE_USDC_TEST_TABLE_RATES = [
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
    [0.68,0.12,0.07344],
    [0.7,0.125,0.07875],
    [0.725,0.13125,0.085640625],
    [0.8,0.15,0.108],
    [0.799999,0.14999975,0.107999685000225],
    [0.8057,0.1557,0.112902741],
    [0.800001,0.150001,0.1080008550009],
    [0.825,0.175,0.1299375],
    [0.85,0.2,0.153],
    [0.8695,0.2195,0.171769725],
    [0.875,0.225,0.1771875],
    [0.9,0.25,0.2025],
    [0.925,0.412500000000001,0.34340625],
    [0.95,0.575,0.491625],
    [0.975,0.7375,0.64715625],
    [0.999,0.8935,0.80334585],
    [1,0.9,0.81],
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

const AVALANCHE_WAVAX_SPREAD = toWei('0.000001');
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
