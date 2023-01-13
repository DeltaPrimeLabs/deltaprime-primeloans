import TOKEN_MANAGER_TUP from "../../deployments/avalanche/TokenManagerTUP.json";
import FlashloanLiquidationArtifact from '../../deployments/avalanche/LiquidationFlashloan.json';
import {liquidateLoan} from "./liquidation-bot-flashloan";
import {ethers} from "hardhat";
const {getUrlForNetwork} = require("../scripts/helpers");

import {
    getLiquidatorSigner, unstakeStakedPositions,
    unstakeYieldYak,
    unwindPangolinLPPositions,
    unwindTraderJoeLPPositions,
    wrapLoan
} from "./utlis";

const ZERO = ethers.constants.AddressZero;

const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const accountAddress = args.accountAddress ? args.accountAddress : ZERO;
const unwindLPs = args.unwindLPs ? args.unwindLPs : false;
const unstakeYY = args.unstakeYY ? args.unstakeYY : false;
const unstakeSP = args.unstakeSP ? args.unstakeSP : false;
const abortIfSolvent = args.abortIfSolvent ? args.abortIfSolvent : true;
const unwindGasPrice = args.unwindGasPrice ? args.unwindGasPrice : 0;
const liquidationGasPrice = args.liquidationGasPrice ? args.liquidationGasPrice : 0;

const RPC_URL = getUrlForNetwork(network);
let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let liquidator_wallet = getLiquidatorSigner(network);

async function getWrappedLoan(loanAddress){
    return await wrapLoan(loanAddress, liquidator_wallet)
}

async function isLoanSolvent(wrappedLoan){
    return await wrappedLoan.isSolvent();
}


function validateAddress(address){
    if(address === ZERO){
        throw new Error(`Invalid address (${address})! Use the --acountAddress parameter to supply the loan address.`);
    }
}

async function conditionalUnstake(wrappedLoan){
    if(unstakeYY){
        await unstakeYieldYak(wrappedLoan, liquidator_wallet, provider, unwindGasPrice);
    }
    if(unwindLPs){
        await unwindPangolinLPPositions(wrappedLoan, liquidator_wallet, provider, unwindGasPrice);
        await unwindTraderJoeLPPositions(wrappedLoan, liquidator_wallet, provider, unwindGasPrice);
    }
    if(unstakeSP){
        await unstakeStakedPositions(wrappedLoan, unwindGasPrice);
    }
}

async function loanManualLiquidation(){
    validateAddress(accountAddress);
    const wrappedLoan = await getWrappedLoan(accountAddress);

    if(abortIfSolvent && (await isLoanSolvent(wrappedLoan))){
        throw new Error(`Loan (${wrappedLoan.address}) is solvent! No need to liquidate.`);
    }

    await conditionalUnstake(wrappedLoan);

    await liquidateLoan(accountAddress, FlashloanLiquidationArtifact.address, TOKEN_MANAGER_TUP.address, false, false, liquidationGasPrice);
}

const run = loanManualLiquidation;

console.log(`Liquidating ${accountAddress}. \nNetwork: ${network} (${RPC_URL}) \nunwindLPs: ${unwindLPs} \nunwindLPs: ${unstakeYY} \nunwindLPs: ${unstakeSP} \n
abortIfSolvent: ${abortIfSolvent} \nunwindGasPrice: ${unwindGasPrice} \nliquidationGasPrice: ${liquidationGasPrice} \n`);
run();