const jsonRPC = "https://rpc.ankr.com/avalanche";
import config from "../../config";

const ethers = require("ethers");
const fs = require("fs");
const {formatUnits} = require("ethers/lib/utils");
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");
// import TOKEN_MANAGER from '../../deployments/avalanche/TokenManager.json';
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const fromWei = val => parseFloat(ethers.utils.formatEther(val));

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const vaultAbi = [
    'function getPoolTokens(bytes32) public view returns (address[],uint256[],uint256)'
];

const poolAbi = [
    'function getRate() public view returns (uint256)'
];

const AAVE_BALANCER_POOL = "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22";
const AAVE_BALANCER_POOL_ID = "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22000000000000000000000010";
const sAVAX_WAVAX_BALANCER_POOL = "0xa154009870e9b6431305f19b09f9cfd7284d4e7a";
const sAVAX_WAVAX_BALANCER_POOL_ID = "0xa154009870e9b6431305f19b09f9cfd7284d4e7a000000000000000000000013";

async function lfb() {
    const redstonePriceDataRequest = await fetch(config.redstoneFeedUrl);
    const redstonePriceData = await redstonePriceDataRequest.json();

    console.log(redstonePriceData);

    // let vault = new ethers.Contract('0xBA12222222228d8Ba445958a75a0704d566BF2C8', vaultAbi, wallet);

    // console.log('tokens: ')
    // console.log(tokens)
    //
    // let tokenManager = new ethers.Contract(TOKEN_MANAGER.address, TOKEN_MANAGER.abi, wallet);

    let pool = new ethers.Contract(AAVE_BALANCER_POOL, poolAbi, wallet);

    let rate = await pool.getRate();

    console.log('rate: ', fromWei(rate))
}

function addressToSymbol(address) {
    //TODO: AAVE return token
    if (address === '0xA291Ae608d8854CdbF9838E28E9BADCf10181669') {
        return "AVAX"; //probably another pricing should be included here
    } else if (address === "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7") {
        return "AVAX"; //probably another pricing should be included here
    } else if (address === "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be") {
        return "sAVAX";
    }
}

async function run() {
    await lfb();
}

run();

async function getBlockForTimestamp(timestamp) {
    const dater = new EthDater(
        provider // ethers provider, required.
    );

    return await dater.getDate(
        timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
        true // Block after, optional. Search for the nearest block before or after the given date. By default true.
    );
}