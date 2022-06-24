import PANGOLIN_EXCHANGETUP from '../../deployments/mainnet/PangolinExchangeTUP.json'
import PANGOLIN_EXCHANGE from '../../artifacts/contracts/PangolinExchange.sol/PangolinExchange.json'
import LOAN_FACTORYTUP from '../../deployments/mainnet/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '../../deployments/mainnet/SmartLoansFactory.json'
import LOAN_LOGIC from '../../artifacts/contracts/faucets/SmartLoanLogicFacet.sol/SmartLoanLogicFacet.json'
import LOAN_LIQUIDATION from '../../artifacts/contracts/faucets/SmartLoanLiquidationFacet.sol/SmartLoanLiquidationFacet.json'
import addresses from '../../common/token_addresses.json';
import {fromBytes32, toSupply} from "../../test/_helpers";

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
const exchange = new ethers.Contract(PANGOLIN_EXCHANGETUP.address, PANGOLIN_EXCHANGE.abi, wallet);


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

function wrapLiquidationFacet(loanAddress) {
    let loan = new ethers.Contract(loanAddress, LOAN_LIQUIDATION.abi, wallet);

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
        if((await wrapLoanStatus(loan)).isSolvent === false) {
            insolventLoans.push(loan)
        }
    }));
    return insolventLoans
}

export async function liquidateLoan(loanAddress) {
    let loan = wrapLogicFacet(loanAddress);
    let liquidateFacet = wrapLiquidationFacet(loanAddress);
    let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;
    let prices = (await loan.getAllAssetsPrices()).map(el => el.toNumber() / 10**8);
    let [tv, debt] = await loan.getFullLoanStatus();

    let assetsSymbols = await exchange.getAllAssets();
    let indices = await loan.getPoolsAssetsIndices();

    let assetBalances = await loan.getAllAssetsBalances();
    let poolTokens = await loan.getPoolTokens();
    let debtsInWei = await loan.getDebts();
    let decimals = await getDecimals(assetsSymbols);

    const bonus = calculateBonus(
        'LIQUIDATE',
        fromWei(debt),
        fromWei(tv),
        4.1,
        maxBonus
    );

    const neededToRepay = toRepay(
        'LIQUIDATE',
        fromWei(debt),
        fromWei(tv),
        4.1,
        bonus
    )

    let balances = [];

    for (const [i, balance] of (assetBalances).entries()) {
        balances.push(formatUnits(balance, decimals[i]));
    }

    const debts = [];

    for (const [index, debt] of debtsInWei.entries()) {
        debts.push(formatUnits(debt, decimals[indices[index]]));
    }

    const repayAmounts = getRepayAmounts(
        debts,
        indices,
        neededToRepay,
        prices
    );

    let repayAmountsInWei = await Promise.all(repayAmounts.map(
        async (amount, i) => {
            let decimal = decimals[indices[i]];
            return parseUnits((amount.toFixed(decimal) ?? 0).toString(), decimal);
        }
    ));

    let allowanceAmounts = toSupply(
        indices,
        balances,
        repayAmounts
    );

    for (let [i, amount] of allowanceAmounts.entries()) {
        let token = getTokenContract(poolTokens[i]);
        let decimal = decimals[indices[i]];
        let allowance = parseUnits((amount.toFixed(decimal) ?? 0).toString(), decimal);
        await token.approve(loan.address, allowance);
    }

    const bonusInWei = (bonus * 1000).toFixed(0);

    let tx = await liquidateFacet.liquidateLoan(repayAmountsInWei, bonusInWei, {gasLimit: 8000000});
    console.log("Waiting for tx: " + tx.hash);
    let receipt = await provider.waitForTransaction(tx.hash);
    console.log("Sellout processed with " + (receipt.status == 1 ? "success" : "failure"));
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
