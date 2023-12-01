import {WrapperBuilder} from "@redstone-finance/evm-connector";
import config from "../../src/config";
import CACHE_LAYER_URLS from "../../common/redstone-cache-layer-urls.json";
import addresses from "../../common/addresses/arbitrum/token_addresses.json";
const fetch = require("node-fetch");

const loanAddress = "0x4a4B8C28922FfC8F1E7Ce0969B49962a926B1184";
const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const FACTORY_ARTIFACT = require(`../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json`);
const ethers = require("ethers");
const fs = require("fs");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const fromBytes32 = ethers.utils.parseBytes32String;

let wrappedLoan;

let factory = new ethers.Contract('0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20', FACTORY_ARTIFACT.abi, wallet);

run().then(() => console.log('Finished!'))

let totalLeveragedGm = 0;
let totalGmsBalance = 0;

async function run() {
    let loans = await factory.getAllLoans();

    const redstonePriceDataRequest = await fetch('https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod');
    const redstonePriceData = await redstonePriceDataRequest.json();

    let i = 0;
    for (let loan of loans) {
        let [leveragedGm, gmsBalance] = await getData(loan, redstonePriceData);
        totalLeveragedGm += leveragedGm;
        totalGmsBalance += gmsBalance;
        console.log(`totalLeveragedGm for ${i + 1} loans: `, totalLeveragedGm);
        i++;
    }

    const boostApy = 10000 / 7 * 365 / totalLeveragedGm;

    console.log('totalLeveragedGm: ', totalLeveragedGm);
    console.log('totalGmsBalance: ', totalGmsBalance);
    console.log('boostApy: ', boostApy);
}



async function getData(loanAddress, redstonePriceData) {
    let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);
    wrappedLoan = await wrapContract(loan);

    let balances = await loan.getAllAssetsBalances();
    balances = balances.map(
        balance => {
            return [fromBytes32(balance[0]), fromWei(balance[1])]
        });

    let status = (await wrappedLoan.getFullLoanStatus()).map(el => fromWei(el));

    let collateral = status[0] - status[1];

    let gmEthWorth = balances.find(bal => bal[0] == 'GM_ETH_WETH_USDC')[1] * redstonePriceData['GM_ETH_WETH_USDC'][0].dataPoints[0].value;
    let gmBtcWorth = balances.find(bal => bal[0] == 'GM_BTC_WBTC_USDC')[1] * redstonePriceData['GM_BTC_WBTC_USDC'][0].dataPoints[0].value;
    let gmArbWorth = balances.find(bal => bal[0] == 'GM_ARB_ARB_USDC')[1] * redstonePriceData['GM_ARB_ARB_USDC'][0].dataPoints[0].value;
    let gmUniWorth = balances.find(bal => bal[0] == 'GM_UNI_UNI_USDC')[1] * redstonePriceData['GM_UNI_UNI_USDC'][0].dataPoints[0].value;
    let gmLinkWorth = balances.find(bal => bal[0] == 'GM_LINK_LINK_USDC')[1] * redstonePriceData['GM_LINK_LINK_USDC'][0].dataPoints[0].value;

    let gmBalance =
        balances.find(bal => bal[0] == 'GM_ETH_WETH_USDC')[1] +
        balances.find(bal => bal[0] == 'GM_BTC_WBTC_USDC')[1] +
        balances.find(bal => bal[0] == 'GM_ARB_ARB_USDC')[1] +
        balances.find(bal => bal[0] == 'GM_UNI_UNI_USDC')[1] +
        balances.find(bal => bal[0] == 'GM_LINK_LINK_USDC')[1];


    let gmWorth = gmEthWorth + gmBtcWorth + gmArbWorth + gmUniWorth + gmLinkWorth;

    let leveragedGm = gmWorth - collateral > 0 ? gmWorth - collateral : 0;

    console.log('--------------------')
    console.log('loanAddress: ', loanAddress)
    console.log('collateral: ', collateral)
    console.log('gmWorth: ', gmWorth)
    console.log('leveragedGm: ', leveragedGm)

    return [leveragedGm, gmBalance];
}

const wrapContract = async function wrapContract(contract, assets) {
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
