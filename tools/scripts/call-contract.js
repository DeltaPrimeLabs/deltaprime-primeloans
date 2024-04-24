import {WrapperBuilder} from "@redstone-finance/evm-connector";
import config from "../../src/config";
import CACHE_LAYER_URLS from "../../common/redstone-cache-layer-urls.json";

const contractName = "SmartLoanGigaChadInterface";
const contractAddress = "0x2019526238AFC079A28a3115023f75ad3dC2e4D8";
const contractMethod = "getHealthRatio";
const jsonRPC = "https://arb1.arbitrum.io/rpc";

const ARTIFACT = require(`../../artifacts/contracts/interfaces/${contractName}.sol/${contractName}.json`);
const ethers = require("ethers");
const fs = require("fs");
async function wrapContract(contract, assets) {
    //for more symbols in data feed it's more optimal to not specify asset list
    const providedAssets = (assets && assets.length <= 5) ? assets : undefined;

    return WrapperBuilder.wrap(contract).usingDataService(
        {
            dataServiceId: 'redstone-arbitrum-prod',
            uniqueSignersCount: 3,
            dataFeeds: providedAssets,
            disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
    );
};
const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let contract = new ethers.Contract(contractAddress, ARTIFACT.abi, wallet);
export const fromWei = val => parseFloat(ethers.utils.formatEther(val));


run();

async function check() {
    let wrappedLoan = await wrapContract(contract);
    let res = await wrappedLoan[contractMethod]();
    console.log(fromWei(res))
}

function run() {
    check();
}
