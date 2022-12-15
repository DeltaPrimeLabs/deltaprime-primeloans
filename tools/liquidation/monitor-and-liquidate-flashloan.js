import TOKEN_MANAGER_TUP from "../../deployments/avalanche/TokenManagerTUP.json";
import {liquidateLoan} from "./liquidation-bot-flashloan";
import {ethers} from "hardhat";
const {getUrlForNetwork} = require("../scripts/helpers");

import LOAN_FACTORYTUP from "../../deployments/avalanche/SmartLoansFactoryTUP.json";
import LOAN_FACTORY from "../../deployments/avalanche/SmartLoansFactory.json";
import {getLiquidatorSigner, wrapLoan} from "./utlis";

const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;
const minutesSync = args.minutesSync ? args.minutesSync : 0;

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

async function liquidateInsolventLoans() {
    let date = new Date();
    if (date.getMinutes() % 2 == minutesSync) {
        healthcheckPing();
        let loans = await getInsolventLoans();

        for (const loan of loans) {
            console.log(`Liquidating: ${loan}`);
            await liquidateLoan(loan, "0x70ab2d076ecA5C0cAd2B92a346839057c4523CA2", TOKEN_MANAGER_TUP.address);
        }
    }
    setTimeout(liquidateInsolventLoans, interval * 1000);
}

const run = liquidateInsolventLoans;

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}. Minutes sync: ${minutesSync}`);
run();