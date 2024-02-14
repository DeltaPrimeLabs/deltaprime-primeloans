const jsonRPC = "https://rpc.ankr.com/avalanche";

const ethers = require("ethers");
const fs = require("fs");
const {formatUnits} = require("ethers/lib/utils");
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const steakhutVaultAbi = [
    'function getUnderlyingAssets(uint256) public view returns (uint256, uint256)',
    'function balanceOf(address) public view returns (uint256)',
    'function totalSupply() public view returns (uint256)',
];

const vaults = [
        "SHLB_AVAX-USDC_B",
        // "SHLB_BTC.b-AVAX_B",
        // "SHLB_USDT.e-USDt_C",
        // "SHLB_EUROC-USDC_V2_1_B"
        // "SHLB_GMX-AVAX_B"
    ];

const TIMESTAMP_NOW = Date.now();
const PREVIOUS_TIMESTAMP = Date.now() -50 * 24 * 3600 * 1000;

async function lfg(vault) {
    const previousPrice = (await redstone.getHistoricalPrice(vault, {date: PREVIOUS_TIMESTAMP})).value;
    const currentPrice = (await redstone.getHistoricalPrice(vault, {date: TIMESTAMP_NOW})).value;

    console.log('token: ', vault);
    console.log('previousPrice: ', previousPrice);
    console.log('currentPrice: ', currentPrice);
    console.log('change: ', ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2), '%');
}

async function lfg2(vault) {
    const blockData = await getBlockForTimestamp(PREVIOUS_TIMESTAMP);

    let vaultContract = new ethers.Contract('0x668530302c6ecc4ebe693ec877b79300ac72527c', steakhutVaultAbi, wallet);

    let previousBalance = formatUnits(await vaultContract.balanceOf('0xB058DDDBcF513D7159cca9e7D776Ee0bF18E36E9', {
        blockTag: blockData.block,
    }), 18);

    let currentBalance = formatUnits(await vaultContract.balanceOf('0xB058DDDBcF513D7159cca9e7D776Ee0bF18E36E9'), 18);

    let change = currentBalance - previousBalance;

    console.log('previousBalance: ', previousBalance)
    console.log('change: ', change)
    console.log('change %: ', change / previousBalance)
}

async function run() {
    for (let vault of vaults) {
        await lfg(vault);
    }
}

async function run2() {
    for (let vault of vaults) {
        await lfg2(vault);
    }}

run2();

async function getBlockForTimestamp(timestamp) {
    const dater = new EthDater(
        provider // ethers provider, required.
    );

    return await dater.getDate(
        timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
        true // Block after, optional. Search for the nearest block before or after the given date. By default true.
    );
}