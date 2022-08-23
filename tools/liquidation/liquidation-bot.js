import LOAN_FACTORYTUP from '../../deployments/mainnet/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '../../deployments/mainnet/SmartLoansFactory.json'
import LOAN_LOGIC from '../../artifacts/contracts/faucets/SmartLoanLogicFacet.sol/SmartLoanLogicFacet.json'
import SOLVENCY_LOGIC from '../../artifacts/contracts/faucets/SolvencyFacet.sol/SolvencyFacet.json'
import LOAN_LIQUIDATION from '../../artifacts/contracts/faucets/SmartLoanLiquidationFacet.sol/SmartLoanLiquidationFacet.json'
import addresses from '../../common/addresses/avax/token_addresses.json';
import {fromBytes32, toSupply} from "../../test/_helpers";
import TOKEN_MANAGER from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import POOL from '../../artifacts/contracts/Pool.sol/Pool.json';
import {fromBytes32, toBytes32, toSupply} from "../../test/_helpers";
import redstone from "redstone-api";

const args = require('yargs').argv;
const https = require('https');
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;
const minutesSync = args.minutesSync ? args.minutesSync : 0;
const ethers = require('ethers');
const {getUrlForNetwork} = require("../scripts/helpers");
const {WrapperBuilder} = require("redstone-evm-connector");
const fs = require('fs');
const {calculateBonus, fromWei, toRepay, formatUnits, getRepayAmounts} = require("../../test/_helpers");
const {parseUnits} = require("ethers/lib/utils");
const path = require("path");

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]

const PRIVATE_KEY =  fs.readFileSync(path.resolve(__dirname, "./.private")).toString().trim();
const RPC_URL = getUrlForNetwork(network);

let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let wallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);
const factory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, wallet);


async function wrapLoanStatus(loanAddress) {
    let loan = wrapLogicFacet(loanAddress);
    let rawStatus = await loan.getFullLoanStatus();
    let status = {
        value: rawStatus[0].toString(),
        debt: rawStatus[1].toString(),
        solvencyRatio: parseFloat(rawStatus[2].toString()),
        isSolvent: parseInt(rawStatus[3].toString()) == 1 ? true : false
    };
    return status;
}

function wrapLogicFacet(loanAddress) {
    let loan = new ethers.Contract(loanAddress, LOAN_LOGIC.abi, wallet);

    loan = WrapperBuilder
        .wrapLite(loan)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche
    return loan
}

function getSolvencyLoan(loanAddress) {
    let loan = new ethers.Contract(loanAddress, SOLVENCY_LOGIC.abi, wallet);

    loan = WrapperBuilder
        .wrapLite(loan)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche
    return loan
}

function wrapLiquidationFacet(loanAddress) {
    let loan = new ethers.Contract(loanAddress, LOAN_LIQUIDATION.abi, wallet);

    loan = WrapperBuilder
        .wrapLite(loan)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche
    return loan
}

function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, wallet);
}

async function getPoolContract(tokenManager, asset) {
    let poolAddress = await tokenManager.getPoolAddress(asset);
    return new ethers.Contract(poolAddress, POOL.abi, wallet);
}

async function getAllLoans() {
    return await factory.getAllLoans();
}

async function getInsolventLoans() {
    let loans = await getAllLoans();
    let insolventLoans = []
    await Promise.all(loans.map(async (loan) => {
        if((await wrapLoanStatus(loan)).isSolvent === false) {
            insolventLoans.push(loan)
        }
    }));
    return insolventLoans
}

export async function liquidateLoan(loanAddress, tokenManagerAddress) {
    let loan = wrapLogicFacet(loanAddress);
    let solvencyLoan = getSolvencyLoan(loanAddress);
    let liquidateFacet = wrapLiquidationFacet(loanAddress);
    let tokenManager = getTokenManager(tokenManagerAddress);
    let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;

    const bonus = calculateBonus(
        'LIQUIDATE',
        fromWei(await solvencyLoan.getDebt()),
        fromWei(await solvencyLoan.getTotalValue()),
        4.1,
        maxBonus
    );

    const neededToRepay = toRepay(
        'LIQUIDATE',
        fromWei(await solvencyLoan.getDebt()),
        fromWei(await solvencyLoan.getTotalValue()),
        4.1,
        bonus
    )

    const balances = {};
    for (const asset of (await loan.getAllOwnedAssets())) {
        let balance = await getTokenContract(addresses[fromBytes32(asset)]).balanceOf(loan.address);
        let decimals = await getTokenContract(addresses[fromBytes32(asset)]).decimals();
        balances[fromBytes32(asset)] = formatUnits(balance, decimals);
    }

    const debts = {};

    for (const asset of (await tokenManager.getAllPoolAssets())){
        let poolContract = await getPoolContract(tokenManager, asset);
        let debt = await poolContract.getBorrowed(loan.address)
        let decimals = await getTokenContract(addresses[fromBytes32(asset)]).decimals();
        debts[fromBytes32(asset)] = formatUnits(debt, decimals);
    }

    let pricesArg = {}
    for (const asset of await tokenManager.getAllPoolAssets()) {
        pricesArg[fromBytes32(asset)] = (await redstone.getPrice(fromBytes32(asset), {provider: "redstone-avalanche-prod-node-3"})).value;
    }

    const repayAmounts = getRepayAmounts(
        debts,
        neededToRepay,
        pricesArg
    );

    let amountsToRepayInWei = [];
    let assetsToRepay = [];
    for (const [asset, amount] of Object.entries(repayAmounts) ) {
        let decimals = await getTokenContract(addresses[asset]).decimals();
        amountsToRepayInWei.push(parseUnits((Number(amount).toFixed(decimals) ?? 0).toString(), decimals));
        assetsToRepay.push(toBytes32(asset));
    }

    let allowanceAmounts = toSupply(
        balances,
        repayAmounts
    );

    for (const [asset, amount] of Object.entries(allowanceAmounts)) {
        let tokenContract = await getTokenContract(addresses[asset]);
        let decimals = await tokenContract.decimals();
        let allowance = parseUnits((Number(amount).toFixed(decimals) ?? 0).toString(), decimals);
        await tokenContract.connect(wallet).approve(loan.address, allowance);
    }

    const bonusInWei = (bonus * 1000).toFixed(0);

    let tx = await liquidateFacet.liquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei, {gasLimit: 8000000});
    await provider.waitForTransaction(tx.hash);
}


function healthcheckPing() {
    console.log(`[${(new Date).toLocaleString()}][HEALTHCHECK] Ping!`);
    https.get('https://hc-ping.com/7581371b-01cc-4a9a-96d2-711464fcd2cc').on('error', (err) => {
        console.log('Ping failed: ' + err)
    });
}

async function liquidateInsolventLoans() {
    let date = new Date();
    if (date.getMinutes() % 2 == minutesSync) {
        healthcheckPing();
        let loans = await getInsolventLoans();
        console.log(`INSOLVENT LOANS[${loans.length}]: ${loans}`)

        for(const x in loans) {
            await liquidateLoan(loans[x]);
        }
    }
    setTimeout(liquidateInsolventLoans, interval * 1000);
}

function getTokenContract(address) {
    return new ethers.Contract(address, erc20ABI, wallet);
}

async function getDecimals(symbols) {

   return Promise.all(
        symbols.map(
            symbol => getTokenContract(addresses[fromBytes32(symbol)]).decimals()
        )
    );
}

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}. Minutes sync: ${minutesSync}`);
