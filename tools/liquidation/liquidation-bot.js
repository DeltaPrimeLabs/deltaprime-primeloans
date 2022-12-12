import LOAN_FACTORYTUP from '../../deployments/avalanche/SmartLoansFactoryTUP.json'
import LOAN_FACTORY from '../../deployments/avalanche/SmartLoansFactory.json'
import LOAN_LIQUIDATION
    from '../../artifacts/contracts/facets/SmartLoanLiquidationFacet.sol/SmartLoanLiquidationFacet.json'
import addresses from '../../common/addresses/avax/token_addresses.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {fromBytes32, getLiquidationAmounts, StakedPosition, toWei} from "../../test/_helpers";
import TOKEN_MANAGER from '../../deployments/avalanche/TokenManager.json';
import TOKEN_MANAGER_TUP from '../../deployments/avalanche/TokenManagerTUP.json';
import SMART_LOAN_DIAMOND from '../../deployments/avalanche/SmartLoanDiamondBeacon.json';
import {ethers} from 'hardhat'
import {SmartLoanGigaChadInterface} from "../../typechain";

const args = require('yargs').argv;
const https = require('https');
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;
const minutesSync = args.minutesSync ? args.minutesSync : 0;

const {getUrlForNetwork} = require("../scripts/helpers");
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const fs = require('fs');
const {fromWei, formatUnits} = require("../../test/_helpers");
const {parseUnits} = require("ethers/lib/utils");
const path = require("path");

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]

const PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "./.private")).toString().trim();
const RPC_URL = getUrlForNetwork(network);

let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let wallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);
const factory = new ethers.Contract(LOAN_FACTORYTUP.address, LOAN_FACTORY.abi, wallet);


async function wrapLoanStatus(loanAddress) {
    let loan = await wrapLoan(loanAddress);
    let rawStatus = await loan.getFullLoanStatus();
    let status = {
        value: rawStatus[0].toString(),
        debt: rawStatus[1].toString(),
        getThresholdWeightedValue: rawStatus[2].toString(),
        healthRatio: parseFloat(rawStatus[3].toString()),
        isSolvent: parseInt(rawStatus[4].toString()) == 1 ? true : false
    };
    return status;
}

async function wrapLoan(loanAddress) {
    let loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, wallet);

    loan = WrapperBuilder.wrap(loan).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "USDT", "sAVAX", "QI", "PNG", "PTP", "PNG_AVAX_USDC_LP", "PNG_AVAX_USDT_LP", "PNG_AVAX_ETH_LP", "TJ_AVAX_USDC_LP", "TJ_AVAX_USDT_LP", "TJ_AVAX_ETH_LP", "TJ_AVAX_BTC_LP", "TJ_AVAX_sAVAX_LP", "YY_AAVE_AVAX", "YY_PTP_sAVAX", "YY_PNG_AVAX_USDC_LP", "YY_PNG_AVAX_ETH_LP", "YY_TJ_AVAX_sAVAX_LP", "YY_TJ_AVAX_USDC_LP", "YY_TJ_AVAX_ETH_LP"],
            disablePayloadsDryRun: true
        },
        [
            "https://cache-service-direct-1.a.redstone.finance",
            "https://cache-service-direct-2.a.redstone.finance",
            "https://cache-service-streamr-1.a.redstone.finance",
        ]
    );

    return loan
}

function wrapLiquidationFacet(loanAddress) {
    let loan = new ethers.Contract(loanAddress, LOAN_LIQUIDATION.abi, wallet);

    loan = WrapperBuilder.wrap(loan).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "USDT", "sAVAX", "QI", "PNG", "PTP", "PNG_AVAX_USDC_LP", "PNG_AVAX_USDT_LP", "PNG_AVAX_ETH_LP", "TJ_AVAX_USDC_LP", "TJ_AVAX_USDT_LP", "TJ_AVAX_ETH_LP", "TJ_AVAX_BTC_LP", "TJ_AVAX_sAVAX_LP", "YY_AAVE_AVAX", "YY_PTP_sAVAX", "YY_PNG_AVAX_USDC_LP", "YY_PNG_AVAX_ETH_LP", "YY_TJ_AVAX_sAVAX_LP", "YY_TJ_AVAX_USDC_LP", "YY_TJ_AVAX_ETH_LP"],
            disablePayloadsDryRun: true
        },
        [
            "https://cache-service-direct-1.a.redstone.finance",
            "https://cache-service-direct-2.a.redstone.finance",
            "https://cache-service-streamr-1.a.redstone.finance",
        ]
    );
    return loan
}

function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, wallet);
}

async function getAllLoans() {
    return await factory.getAllLoans();
}

async function getInsolventLoans() {
    let loans = await getAllLoans();
    let insolventLoans = []
    await Promise.all(loans.map(async (loan) => {
        if ((await wrapLoanStatus(loan)).isSolvent === false) {
            insolventLoans.push(loan)
        }
    }));
    return insolventLoans
}

export async function liquidateLoan(loanAddress, tokenManagerAddress, diamondAddress, diamondOwner) {
    let loan = await wrapLoan(loanAddress);
    let tokenManager = getTokenManager(tokenManagerAddress);
    let poolTokens = await tokenManager.getAllPoolAssets();
    let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;

    //TODO: optimize to unstake only as much as needed
    for (let p of await loan.getStakedPositions()) {
        let stakedPosition = new StakedPosition(p[0], fromBytes32(p[1]), p[2], p[3]);

        let balanceMethod = loan.interface.getFunction(stakedPosition.balanceSelector);
        let unstakeMethod = loan.interface.getFunction(stakedPosition.unstakeSelector);

        await loan[unstakeMethod.name](await loan[balanceMethod.name](), toWei("0"), {gasLimit: 8000000});
    }

    const bonus = Math.abs(fromWei(await loan.getTotalValue()) - fromWei(await loan.getDebt())) < 0.1 ? 0 : maxBonus;

    const weiDebts = (await loan.getDebts());

    const debts = [];
    for (let debt of weiDebts) {
        let symbol = fromBytes32(debt.name);
        debts.push(
            {
                name: symbol,
                debt: formatUnits(debt.debt, await getTokenContract(TOKEN_ADDRESSES[symbol]).decimals())
            });
    }

    const balances = [];

    const weiBalances = (await loan.getAllAssetsBalances());
    for (let balance of weiBalances) {
        let symbol = fromBytes32(balance.name);

        balances.push(
            {
                name: symbol,
                //@ts-ignore
                debtCoverage: fromWei(await tokenManager.debtCoverage(TOKEN_ADDRESSES[symbol])),
                balance: formatUnits(balance.balance, await getTokenContract(TOKEN_ADDRESSES[symbol]).decimals())
            });
    }

    let loanIsBankrupt = await loan.getTotalValue() < await loan.getDebt();

    let prices = (await loan.getAllAssetsPrices()).map(el => {
        return {
            dataFeedId: fromBytes32(el.name),
            value: formatUnits(el.price, 8)
        }
    });

    let {repayAmounts, deliveredAmounts} = getLiquidationAmounts(
        'LIQUIDATE',
        debts,
        balances,
        prices,
        1.04,
        bonus,
        loanIsBankrupt
    );

    let amountsToRepayInWei = [];

    for (const repayment of repayAmounts) {
        let tokenContract = await getTokenContract(addresses[repayment.name]);
        let decimals = await tokenContract.decimals();
        amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
    }

    for (const allowance of deliveredAmounts) {
        let tokenContract = await getTokenContract(addresses[allowance.name]);
        let decimals = await tokenContract.decimals();
        let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
        await tokenContract.connect(wallet).approve(loan.address, delivered);
    }
    const bonusInWei = (bonus * 1000).toFixed(0);

    let liquidatorsList = await ethers.getContractAt('ISmartLoanLiquidationFacet', diamondAddress, diamondOwner);
    if (!(await liquidatorsList.isLiquidatorWhitelisted(wallet.address))) {
        await liquidatorsList.whitelistLiquidators([wallet.address]);
    }

    if (!loanIsBankrupt) {
        let tx = await loan.liquidateLoan(poolTokens, amountsToRepayInWei, bonusInWei, {gasLimit: 8000000});
        await provider.waitForTransaction(tx.hash);
    } else {
        console.log('This loan is bankrupt sir. I\'m not touching it, sawry!');
    }
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

        for (const x in loans) {
            await liquidateLoan(loans[x], TOKEN_MANAGER_TUP.address, SMART_LOAN_DIAMOND.address, wallet);
        }
    }
    setTimeout(liquidateInsolventLoans, interval * 1000);
}

const run = liquidateInsolventLoans;


function getTokenContract(address) {
    return new ethers.Contract(address, erc20ABI, wallet);
}

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}. Minutes sync: ${minutesSync}`);
run();

module.exports.liquidateInsolventLoans = liquidateInsolventLoans;