const EthDater = require('ethereum-block-by-date');

const LOAN_ADDRESS = "0xB058DDDBcF513D7159cca9e7D776Ee0bF18E36E9";
const TIMESTAMP = 1683553932000;
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const fs = require("fs");
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const {queryHistoricalFeeds} = require("./query-arweave");
import { SignedDataPackage } from "redstone-protocol";
import {fromWei} from "../../test/_helpers";
import CACHE_LAYER_URLS from "../../common/redstone-cache-layer-urls.json";

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const Web3 = require('web3');
const web = new Web3(new Web3.providers.HttpProvider(jsonRPC));


let wallet = mnemonicWallet.connect(provider);
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));


run().then(() => console.log('Finished!'))

async function run() {
    await getData(LOAN_ADDRESS, TIMESTAMP);
}

async function getData(loanAddress, timestamp) {
    let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);

    const nodeAddress1 = '0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747';
    const nodeAddress2 = '0x2c59617248994D12816EE1Fa77CE0a64eEB456BF';
    const nodeAddress3 = '0x12470f7aBA85c8b81D63137DD5925D6EE114952b';
    //do dziesietnych

    const dater = new EthDater(web);

    let blockData = await dater.getDate(timestamp);

    let block = await provider.getBlock(blockData.block);

    let approxTimestamp = parseInt((block.timestamp / 10).toString()) * 10; //requirement for Redstone

    const feeds = await queryHistoricalFeeds(approxTimestamp, [nodeAddress1, nodeAddress2, nodeAddress3]);

    let packages = [];


    for (let obj of feeds) {

        let txId = obj.node.id;
        let url = `https://arweave.net/${txId}`;

        const response = await fetch(url);

        const json = await response.json();

        const dataPackage = SignedDataPackage.fromObj(json)

        packages.push(dataPackage);
    }

    const wrappedContract =
        WrapperBuilder.wrap(loan).usingDataPackages(packages);

    const tx = await wrappedContract.populateTransaction.getHealthRatio()

    let res = await loan.signer.call(tx, block.number)


    const decoded = loan.interface.decodeFunctionResult(
        'getHealthRatio',
        res
    );

    console.log('health ratio: ')
    console.log(fromWei(decoded[0]))

}