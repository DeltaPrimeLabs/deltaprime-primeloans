import TOKEN_MANAGER from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import LIQUIDATION_FLASHLOAN from '../../artifacts/contracts/LiquidationFlashloan.sol/LiquidationFlashloan.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import {fromBytes32, toBytes32, toSupply} from "../../test/_helpers";

const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;
const minutesSync = args.minutesSync ? args.minutesSync : 0;
import {ethers} from 'hardhat'
import redstone from "redstone-api";
import POOL from "../../artifacts/contracts/Pool.sol/Pool.json";
const {getUrlForNetwork} = require("../scripts/helpers");
const {WrapperBuilder} = require("../../../redstone-evm-connector/lib");
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


async function wrapLoan(loanAddress) {
    let loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, wallet);

    await loan.getMaxLiquidationBonus();

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

export async function liquidateLoan(loanAddress,  flashLoanAddress, tokenManagerAddress) {
    let loan = await wrapLoan(loanAddress);
    let tokenManager = getTokenManager(tokenManagerAddress);
    let poolTokens = await tokenManager.getAllPoolAssets();
    let poolTokenAddresses = await Promise.all(poolTokens.map(el => tokenManager.getAssetAddress(el, true)));
    let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;

    const bonus = calculateBonus(
        'LIQUIDATE',
        fromWei(await loan.getDebt()),
        fromWei(await loan.getTotalValue()),
        4.1,
        maxBonus
    );

    const neededToRepay = toRepay(
        'LIQUIDATE',
        fromWei(await loan.getDebt()),
        fromWei(await loan.getTotalValue()),
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
        'LIQUIDATE',
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

    let flashLoan = new ethers.Contract(flashLoanAddress, LIQUIDATION_FLASHLOAN.abi, wallet);

    flashLoan = WrapperBuilder
        .wrapLite(flashLoan)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche

    const flashLoanTx = await flashLoan.executeFlashloan(
    {
        assets: poolTokenAddresses,
        amounts: amountsToRepayInWei,
        interestRateModes: new Array(poolTokenAddresses.length).fill(0), 
        params: '0x' + await loan.getPriceData(),
        bonus: bonusInWei,
        liquidator: wallet.address,
        loanAddress: loanAddress,
        tokenManager: tokenManager.address
    }, {
        gasLimit: 100_000_000_000
      }
    );

    console.log("Waiting for flashLoanTx: " + flashLoanTx.hash);
    let receipt = await provider.waitForTransaction(flashLoanTx.hash);
    console.log("Sellout processed with " + (receipt.status == 1 ? "success" : "failure"));
}

function getTokenContract(address) {
    return new ethers.Contract(address, erc20ABI, wallet);
}

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}. Minutes sync: ${minutesSync}`);
