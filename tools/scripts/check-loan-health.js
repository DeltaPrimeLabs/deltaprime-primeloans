const { WrapperBuilder } = require('@redstone-finance/evm-connector');
const loanAddress = "0x03f838e242292396ed2EE973A00C8bD7515bb16E";
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const fs = require("fs");
const fromWei = (val) => parseFloat(ethers.utils.formatEther(val));
const fromBytes32 = ethers.utils.parseBytes32String;
const CACHE_LAYER_URLS = require('../../common/redstone-cache-layer-urls.json');

let mnemonicWallet = new ethers.Wallet('0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809');
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);
let wrappedLoan;

run().then(() => console.log('Finished!'))

async function wrapContract(contract, assets) {
    //for more symbols in data feed it's more optimal to not specify asset list
    const providedAssets = (assets && assets.length <= 5) ? assets : undefined;
  
    return WrapperBuilder.wrap(contract).usingDataService(
      {
        dataServiceId: 'redstone-avalanche-prod',
        uniqueSignersCount: 3,
        dataFeeds: providedAssets,
        disablePayloadsDryRun: true
      },
      CACHE_LAYER_URLS.urls
    );
  };

async function run() {
    await prepare();
    await getData();
}

async function prepare() {
    wrappedLoan = await wrapContract(loan);
}

async function getData() {

    let result = await wrappedLoan.getHealthMeter();
    console.log(fromWei(result));
}