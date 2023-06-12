const address = "0x4a4B8C28922FfC8F1E7Ce0969B49962a926B1184";
// const jsonRPC = "https://rpc.ankr.com/avalanche";
// const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";
const jsonRPC = "https://nd-942-045-793.p2pify.com/8a3ab811da8703a863d7f2b93f65f3d0/ext/bc/C/rpc";

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const SLF_ARTIFACT = require(`../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json`);
const POOL_ARTIFACT = require(`../../artifacts/contracts/Pool.sol/Pool.json`);
const ethers = require("ethers");
const fs = require("fs");
const {wrapContract} = require("../../src/utils/blockchain");
const {fromWei, fromBytes32} = require("../../test/_helpers");
import fetch from 'node-fetch';

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const VALUE_DROP = 0.22; //22%

let directAvaxExposure = 0;
let directSavaxExposure = 0;

let badDebt = 0;
let failed = 0;
const slFactory = new ethers.Contract('0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D', SLF_ARTIFACT.abi, wallet);
const avaxPool = new ethers.Contract('0xD26E504fc642B96751fD55D3E68AF295806542f5', POOL_ARTIFACT.abi, wallet);

run().then(() => console.log('Finished!'))


async function run() {
    console.log(0)
    console.log()
    let loans = await slFactory.getAllLoans();
    console.log(1)

    let i = 0;
    for (let address of loans) {
        try {
            await getData(address, i);
            i++;
        } catch (e) {
            try {
                await getData(address, i);
                i++;
            } catch (e) {
                try {
                    await getData(address, i);
                    i++;
                } catch (e) {
                    failed++;
                }
            }

        }
    }

    console.log('failed: ', failed)
}

async function getData(loanAddress, i) {
    const redstonePriceDataRequest = await fetch('https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-avalanche-prod');
    const redstonePriceData = await redstonePriceDataRequest.json();
    const AVAX_PRICE = redstonePriceData['AVAX'][0].dataPoints[0].value;
    const sAVAX_PRICE = redstonePriceData['sAVAX'][0].dataPoints[0].value;
    console.log('sAVAX_PRICE: ', sAVAX_PRICE)
    console.log('AVAX_PRICE: ', AVAX_PRICE)

    let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);
    let wrappedLoan = await wrapContract(loan);

    let sAVAXExposure = 0;
    let AVAXExposure = 0;

    let balances = await loan.getAllAssetsBalances();
    balances.forEach(
        balance => {
            if(fromBytes32(balance[0]) == 'sAVAX') {
                sAVAXExposure += fromWei(balance[1]);
            }

            if(fromBytes32(balance[0]) == 'YY_PTP_sAVAX') {
                sAVAXExposure += fromWei(balance[1]);
            }

            if(fromBytes32(balance[0]) == 'YY_AAVE_AVAX') {
                AVAXExposure += fromWei(balance[1]);
            }

            if(fromBytes32(balance[0]) == 'AVAX') {
                AVAXExposure += fromWei(balance[1]);
            }
        });

    // console.log('Staked positions: ')

    AVAXExposure += fromWei(await loan.vectorWAVAX1BalanceAuto());
    sAVAXExposure += fromWei(await loan.vectorSAVAX1BalanceAuto());

    let status = (await wrappedLoan.getFullLoanStatus()).map(el => fromWei(el));
    const tv = status[0];
    console.log('Total value: ', status[0])
    console.log('Debt: ', status[1])
    console.log('TWV: ', status[2])
    console.log('Health: ', status[3])
    console.log('Solvent: ', status[4] === 1e-18)
    const debt = status[1];

    const avaxDebt = fromWei(await avaxPool.getBorrowed(loanAddress));

    const tvalueDrop = (AVAXExposure * AVAX_PRICE + sAVAXExposure * sAVAX_PRICE) * VALUE_DROP;

    if (tvalueDrop > tv) {console.log('apocalypsa'); throw Error()}

    console.log('AVAXExposure * AVAX_PRICE: ', AVAXExposure * AVAX_PRICE)
    console.log('sAVAXExposure + sAVAX_PRICE: ', sAVAXExposure + sAVAX_PRICE)
    console.log('VALUE_DROP: ', VALUE_DROP)
    console.log('tvalueDrop: ', tvalueDrop)

    const effectiveMargin = (tv - tvalueDrop) - (debt - avaxDebt * AVAX_PRICE * VALUE_DROP);

    if (effectiveMargin < 0) {
        badDebt += Math.abs(effectiveMargin);
    }

    directAvaxExposure += AVAXExposure;
    directSavaxExposure += sAVAXExposure;

    console.log('i: ', i)
    console.log('address: ', loanAddress)
    console.log('AVAXExposure: ', AVAXExposure)
    console.log('SAVAXExposure: ', sAVAXExposure)
    console.log('AVAXExposure $: ', AVAXExposure * AVAX_PRICE)
    console.log('SAVAXExposure $: ', sAVAXExposure * sAVAX_PRICE)
    console.log('avax debt: ', avaxDebt)
    console.log('tvalueDrop: ', tvalueDrop)
    console.log('tv: ', tv)

    console.log('----------------')
    console.log('badDebt: ', badDebt)
    console.log('directAvaxExposure: ', directAvaxExposure)
    console.log('directSavaxExposure: ', directSavaxExposure)
    console.log('----------------')

}