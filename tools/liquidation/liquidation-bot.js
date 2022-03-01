const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;

const ethers = require('ethers');
const {WrapperBuilder} = require("redstone-evm-connector");

const FACTORY_ABI = require(`../../deployments/${network}/SmartLoansFactory.json`).abi;
const FACTORY_ADDRESS = require(`../../deployments/${network}/SmartLoansFactoryTUP.json`).address;

const LOAN_ABI = require(`../../deployments/${network}/SmartLoan.json`).abi;

const PRIVATE_KEY = '0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa';
let RPC_URL;
if(network === 'mainnet') {
    RPC_URL = 'https://api.avax.network/ext/bc/C/rpc'
} else if(network === 'fuji') {
    RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc'
} else {
    RPC_URL = ''
}
let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let wallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);
const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

async function getLoanStatus(loanAddress) {
    let loan = getLoanContract(loanAddress);
    let rawStatus = await loan.getFullLoanStatus();
    let status = {
        value: rawStatus[0].toString(),
        debt: rawStatus[1].toString(),
        solvencyRatio: parseFloat(rawStatus[2].toString()),
        isSolvent: parseInt(rawStatus[3].toString()) == 1 ? true : false
    };
    return status;
}

function getLoanContract(loanAddress) {
    let loan = new ethers.Contract(loanAddress, LOAN_ABI, wallet);
    loan = WrapperBuilder
        .wrapLite(loan)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche
    return loan
}

async function getAllLoans() {
    return await factory.getAllLoans();
}

async function getInsolventLoans() {
    let loans = await getAllLoans();
    let insolventLoans = []
    await Promise.all(loans.map(async (loan) => {
        if((await getLoanStatus(loan)).isSolvent === false) {
            insolventLoans.push(loan)
        }
    }))
    return insolventLoans
}

async function liquidateLoan(loanAddress) {
    let loanContract = getLoanContract(loanAddress);
    let rawStatus = await loanContract.getFullLoanStatus();
    let targetLTV = (await loanContract.getMinSelloutLtv()).toNumber() + 100;
    let liquidationBonus = await loanContract.getLiquidationBonus();

    let repayAmount = getSelloutRepayAmount(rawStatus[0], rawStatus[1], liquidationBonus, targetLTV);

    console.log(`Attempting to sellout a loan under ${loanAddress} address to bring to below ${targetLTV} LTV level. Repay amount: ${repayAmount}`);
    let tx = await loanContract.liquidateLoan(repayAmount.toString(), {gasLimit: 8000000});
    console.log("Waiting for tx: " + tx.hash);
    let receipt = await provider.waitForTransaction(tx.hash);
    console.log("Sellout processed with " + (receipt.status == 1 ? "success" : "failure"));
}

function getSelloutRepayAmount(totalValue, debt, bonus, targetLTV) {
    targetLTV = targetLTV / 1000;
    bonus = bonus / 1000;
    let repayAmount = (targetLTV * (totalValue - debt) - debt) / (targetLTV * bonus - 1);
    console.log(`The repay amount for ${totalValue} totalValue, ${debt} debt and ${targetLTV} targetLTV with ${bonus} bonus is ${repayAmount}`);
    return repayAmount;
}

async function liquidateInsolventLoans() {

    let loans = await getInsolventLoans();
    console.log(`INSOLVENT LOANS: ${loans}`)
    for(const x in loans) {
        await liquidateLoan(loans[x]);
    }
    setTimeout(liquidateInsolventLoans, interval * 10)
}

module.exports = {
    liquidateInsolventLoans
};

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}`);
liquidateInsolventLoans()
