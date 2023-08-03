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

const TOKEN_1_SYMBOL = "AVAX";
const TOKEN_2_SYMBOL = "USDC";
const PRIME_ACCOUNT_ADDRESS = "0xB058DDDBcF513D7159cca9e7D776Ee0bF18E36E9";
const STEAKHUT_VAULT_ADDRESS = "0x668530302c6ecc4ebe693ec877b79300ac72527c";
const TIMESTAMP_NOW = Date.now();
const TIMESTAMP_WEEK_AGO = Date.now() - 3600 * 1000 * 24 * 7;

console.log('TIMESTAMP_WEEK_AGO: ', TIMESTAMP_WEEK_AGO)
console.log('TIMESTAMP_NOW: ', TIMESTAMP_NOW)

async function lfg() {
    let vaultContract = new ethers.Contract(STEAKHUT_VAULT_ADDRESS, steakhutVaultAbi, wallet);



    const blockData = await getBlockForTimestamp(TIMESTAMP_WEEK_AGO);

    let previousBalance = await vaultContract.balanceOf(PRIME_ACCOUNT_ADDRESS, {
        blockTag: blockData.block,
    });

    const previousPrice1 = (await redstone.getHistoricalPrice(TOKEN_1_SYMBOL, {date: TIMESTAMP_WEEK_AGO})).value;
    const previousPrice2 = (await redstone.getHistoricalPrice(TOKEN_2_SYMBOL, {date: TIMESTAMP_WEEK_AGO})).value;

    console.log('blockNumber: ', blockData.block)

    let currentBalance = await vaultContract.balanceOf(PRIME_ACCOUNT_ADDRESS);

    const balances = await vaultContract.getUnderlyingAssets(currentBalance);

    const previousBalances = await vaultContract.getUnderlyingAssets(previousBalance, {
        blockTag: blockData.block,
    });

    console.log('TOKEN_1 amount', formatUnits(previousBalances[0], 18))
    console.log('TOKEN_2 amount', formatUnits(previousBalances[1], 6))
    console.log('TOKEN_1 price', previousPrice1)
    console.log('TOKEN_2 price', previousPrice2)

    const currentPrice1 = (await redstone.getHistoricalPrice(TOKEN_1_SYMBOL, {date: TIMESTAMP_NOW})).value;
    const currentPrice2 = (await redstone.getHistoricalPrice(TOKEN_2_SYMBOL, {date: TIMESTAMP_NOW})).value;


    console.log('------------')
    console.log('TOKEN_1 amount', formatUnits(balances[0], 18))
    console.log('TOKEN_2 amount', formatUnits(balances[1], 6))
    console.log('TOKEN_1 price', currentPrice1)
    console.log('TOKEN_2 price', currentPrice2)

}

async function getBlockForTimestamp(timestamp) {
    const dater = new EthDater(
        provider // ethers provider, required.
    );

    return await dater.getDate(
        timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
        true // Block after, optional. Search for the nearest block before or after the given date. By default true.
    );
}

lfg().then(
)

