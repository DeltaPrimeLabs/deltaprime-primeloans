//update for Arbitrum
import config from "../../src/config";

const TOKEN_ADDRESSES = require('../../common/addresses/avalanche/token_addresses.json');

const EthDater = require('ethereum-block-by-date');

const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";

const ethers = require("ethers");
const fs = require("fs");
const {queryHistoricalFeeds} = require("./query-arweave");
import { SignedDataPackage } from "redstone-protocol";
const fromWei = val => parseFloat(ethers.utils.formatEther(val));
import redstone from 'redstone-api';

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const Web3 = require('web3');
const web = new Web3(new Web3.providers.HttpProvider(jsonRPC));


let wallet = mnemonicWallet.connect(provider);
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));




const START_TIMESTAMP = 1706788800;
const END_TIMESTAMP = 1707393600;
const BATCH_SIZE = 5;
const ASSET = "CAI";

async function run() {
    // let json = {};
    let filePath = `volatility-${ASSET}.json`;
    let json = JSON.parse(fs.readFileSync(filePath))

    let dates = [];
    let start = START_TIMESTAMP;
    const interval = 30;
    let iterationEndTimestamp = START_TIMESTAMP + BATCH_SIZE * interval;
    let end = start + interval;

    while (end <= END_TIMESTAMP) {

        while (end <= iterationEndTimestamp) {
            dates.push(start);
            start = end;
            end += interval;
        }

        // let res = await Promise.all(dates.map(timestamp => getData(timestamp)));
        let res = await getDataRS(ASSET, start, end, interval)

        console.log(res)

        dates.forEach(
            (date, i) => {
                json[date] = res[i];
            }
        )

        console.log(`${new Date(dates[dates.length - 1] * 1000)} ${dates[dates.length - 1]}`)


        fs.writeFileSync(filePath, JSON.stringify(json))

        dates = [];

        start = iterationEndTimestamp;
        end = start + interval;
        iterationEndTimestamp += BATCH_SIZE * interval;

    }

}

async function getDataRS(symbol, start, end, interval) {
    console.log(`start: ${start}, end: ${end}, interval: ${interval}`)
    return await redstone.getHistoricalPrice(symbol, {
        startDate: start * 1000,
        interval: interval * 1000,
        endDate: end * 1000,
        provider: 'redstone'
    })
}

async function getData(timestamp) {
    const nodeAddress1 = '0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747';
    const nodeAddress2 = '0x2c59617248994D12816EE1Fa77CE0a64eEB456BF';
    const nodeAddress3 = '0x12470f7aBA85c8b81D63137DD5925D6EE114952b';
    //do dziesietnych

    const dater = new EthDater(web);

    let blockData = await dater.getDate(timestamp * 1000);

    let approxTimestamp = parseInt((blockData.timestamp / 10).toString()) * 10; //requirement for Redstone

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

    return packages.map(data => data.dataPackage.dataPoints).map(point => point[0].numericDataPointArgs);
}

run()



