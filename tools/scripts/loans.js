const config = require('../network/config-local.json');
const fs = require('fs');
const ethers = require('ethers');
const FACTORY = require('@contracts/SmartLoansFactory.json');
const FACTORY_TUP = require('@contracts/SmartLoansFactoryTUP.json');
const LOAN = require('@contracts/SmartLoan.json');
const {WrapperBuilder} = require("redstone-evm-connector");

const mnemonic = fs.readFileSync(".secret").toString().trim();
let privateKeyWallet = new ethers.Wallet(mnemonic);

var provider;

// provider = new ethers.providers.JsonRpcProvider("https://207.154.255.139/");    // Digital Ocean forked node, leave blank for localhost
provider = new ethers.providers.JsonRpcProvider();


let wallet = privateKeyWallet.connect(provider);
let factory = new ethers.Contract(FACTORY_TUP.networks[config["network-id"]].address, FACTORY.abi, wallet);

const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const toWei = ethers.utils.parseEther;

async function createLoan() {
  let tx = await factory.createLoan({gasLimit: 3000000});
  console.log("Loan created: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  let loanAddress = receipt.logs[0].address;
  return loanAddress;
}


async function fundLoan(loanAddress, val) {
  console.log("Funding loan: " + val);
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  let tx = await loan.fund({value: toWei(val.toString()), gasLimit: 3000000});
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Funding processed with " + (receipt.status == 1 ? "success" : "failure"));
}


async function borrowFromPool(loanAddress, amount) {
  console.log("Borrowing funds: " + amount);
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  let tx = await loan.borrow(toWei(amount.toString()), {gasLimit: 3000000});
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Borrowing processed with " + (receipt.status == 1 ? "success" : "failure"));
}


async function setMaxLTV(loanAddress, maxLTV) {
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  let tx = await loan.setMaxLTV(maxLTV, {gasLimit: 2000000});
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Setting maximal LTV processed with " + (receipt.status == 1 ? "success" : "failure"));
}

function getSelloutRepayAmount(totalValue, debt, bonus, targetLTV) {
  targetLTV = targetLTV / 1000;
  bonus = bonus / 1000;
  let repayAmount = (targetLTV * (totalValue - debt) - debt) / (targetLTV * bonus - 1);
  console.log(`The repay amount for ${totalValue} totalValue, ${debt} debt and ${targetLTV} targetLTV with ${bonus} bonus is ${repayAmount}`);
  return repayAmount * 1.04;
}


async function loanSellout(loanAddress) {
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  loan = WrapperBuilder
    .wrapLite(loan)
    .usingPriceFeed("redstone-avalanche"); // redstone-avalanche
  let rawStatus = await loan.getFullLoanStatus();
  let targetLTV = await loan.MAX_LTV();
  let repayAmount = getSelloutRepayAmount(rawStatus[0], rawStatus[1], 100, targetLTV);
  console.log(`Attempting to sellout a loan under ${loanAddress} address to bring it below ${targetLTV} LTV level. Repay amount: ${repayAmount}`);
  let tx = await loan.sellout(repayAmount.toString(), {gasLimit: 2000000});
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Sellout processed with " + (receipt.status == 1 ? "success" : "failure"));
}


async function invest(loanAddress, asset, amount) {
  console.log("Investing: " + amount);
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  let tx = await loan.invest(ethers.utils.formatBytes32String(asset), toWei(amount.toString()), {gasLimit: 3000000});
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Investing processed with " + (receipt.status == 1 ? "success" : "failure"));
}


async function findAllLoans() {
  let loans = await factory.getAllLoans();
  return loans;
}


async function selloutSolventLoan(loanAddress) {
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  loan = WrapperBuilder
    .wrapLite(loan)
    .usingPriceFeed("redstone-avalanche"); // redstone-avalanche
  await loan.selloutLoan({gasLimit: 2000000});
}


async function getLoanStatus(loanAddress) {
  let loan = new ethers.Contract(loanAddress, LOAN.abi, wallet);
  loan = WrapperBuilder
    .wrapLite(loan)
    .usingPriceFeed("redstone-avalanche"); // redstone-avalanche
  let rawStatus = await loan.getFullLoanStatus();
  let status = {
    value: rawStatus[0].toString(),
    debt: rawStatus[1].toString(),
    solvencyRatio: parseFloat(rawStatus[2].toString()),
    isSolvent: parseInt(rawStatus[3].toString()) == 1 ? true : false
  };
  return status;
}


module.exports = {
  findAllLoans,
  getLoanStatus,
  createLoan,
  fundLoan,
  borrowFromPool,
  invest,
  setMaxLTV,
  loanSellout,
  selloutSolventLoan
};
