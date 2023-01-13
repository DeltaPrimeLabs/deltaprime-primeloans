import TOKEN_MANAGER_TUP from "../../deployments/avalanche/TokenManagerTUP.json";
import FlashloanLiquidationArtifact from '../../deployments/avalanche/LiquidationFlashloan.json';
import {liquidateLoan} from "./liquidation-bot-flashloan";
import {ethers} from "hardhat";
const {getUrlForNetwork} = require("../scripts/helpers");

import LOAN_FACTORYTUP from "../../deployments/avalanche/SmartLoansFactoryTUP.json";
import LOAN_FACTORY from "../../deployments/avalanche/SmartLoansFactory.json";
import {getLiquidatorSigner, wrapLoan} from "./utlis";

const https = require('https');
const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;
const liquidationGasPrice = args.liquidationGasPrice ? args.liquidationGasPrice : 0;

const RPC_URL = getUrlForNetwork(network);
let liquidator_wallet = getLiquidatorSigner(network);

const factory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, liquidator_wallet);


async function getAllLoans() {
    return await factory.getAllLoans();
}

async function wrapLoanIsSolvent(loanAddress) {
    let loan = await wrapLoan(loanAddress, liquidator_wallet);
    let isSolvent = await loan.isSolvent();
    return isSolvent;
}

async function getInsolventLoans() {
    let loans = await getAllLoans();
    console.log(`Found ${loans.length} loans.`)
    let insolventLoans = []
    await Promise.all(loans.map(async (loan) => {
        if ((await wrapLoanIsSolvent(loan)) === false) {
            insolventLoans.push(loan)
        }
    }));
    console.log(`${insolventLoans.length} out of ${loans.length} are insolvent.`)
    return insolventLoans
}

function healthcheckPing() {
    console.log(`[${(new Date).toLocaleString()}][HEALTHCHECK] Ping!`);
    // BETA-HR: https://hc-ping.com/3bd80bcc-e9c8-48b8-8f44-e672bb498700
    // BETA-LTV: https://hc-ping.com/5db347bf-6516-4f9b-99ce-5bdcd88e12d0
    // BETA-2k-2k: https://hc-ping.com/cdc33b7f-e908-4598-8c0b-f0343c2cffd4
    https.get('https://hc-ping.com/3bd80bcc-e9c8-48b8-8f44-e672bb498700').on('error', (err) => {
        console.log('Ping failed: ' + err)
    });
}

async function liquidateInsolventLoans() {
    healthcheckPing();
    let loans = await getInsolventLoans();

    for (const loan of loans) {
        console.log(`Liquidating: ${loan}`);
        await liquidateLoan(loan, FlashloanLiquidationArtifact.address, TOKEN_MANAGER_TUP.address, false, true, liquidationGasPrice);
    }
    setTimeout(liquidateInsolventLoans, interval * 1000);
}

const run = liquidateInsolventLoans;

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval} seconds`);
run();