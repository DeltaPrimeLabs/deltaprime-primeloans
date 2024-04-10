import {WrapperBuilder} from "@redstone-finance/evm-connector";
import CACHE_LAYER_URLS from "../../common/redstone-cache-layer-urls.json";

const loanAddress = "0xf74Dfb08B599727400d53fe92197c9Ed310230A6";
const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";
const DATA_SERVICE_ID = "redstone-arbitrum-prod";
const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const fs = require("fs");

const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const fromBytes32 = ethers.utils.parseBytes32String;

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);
let wrappedLoan;

export const wrapContract = async function wrapContract(contract, assets, dataServiceId) {
    //for more symbols in data feed it's more optimal to not specify asset list
    const providedAssets = (assets && assets.length <= 5) ? assets : undefined;

    return WrapperBuilder.wrap(contract).usingDataService(
        {
            dataServiceId: dataServiceId ? dataServiceId : DATA_SERVICE_ID,
            uniqueSignersCount: 3,
            dataFeeds: providedAssets,
            disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
    );
};
// run().then(() => console.log('Finished!'))

async function run() {
    await prepare();
    await getData();
}

async function prepare() {
    wrappedLoan = await wrapContract(loan);
}

async function getData() {
    console.log('getData')
    // await vectorFinanceRewards('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', loanAddress, 18, wallet.provider.getSigner(wallet.address))

    console.log('Balances: ');

    let balances = await loan.getAllAssetsBalances();
    balances.forEach(
        balance => {
            console.log('Symbol: ', fromBytes32(balance[0]))
            console.log('Balance in wei: ', balance[1].toString())
        });

    console.log('Staked positions: ')

    let positions = await loan.getStakedPositions()
    positions.forEach(
        (position, i) => {
            console.log('Position ', i)
            console.log('Asset address: ', position[0])
            console.log('Symbol: ', fromBytes32(position[1]))
            console.log('Identifier: ', fromBytes32(position[2]))
        });

    console.log('Loan status: ',)

    let status = (await wrappedLoan.getFullLoanStatus()).map(el => fromWei(el));
    console.log('Total value: ', status[0])
    console.log('Debt: ', status[1])
    console.log('TWV: ', status[2])
    console.log('Health: ', status[3])
    console.log('Solvent: ', status[4] === 1e-18)

    let owned = (await wrappedLoan.getAllOwnedAssets()).map(el => fromBytes32(el));

    console.log(owned)

}