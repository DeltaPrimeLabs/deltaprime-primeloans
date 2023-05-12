const ethers = require("ethers");
const factoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const FACTORY = require(`./SmartLoansFactory.json`);
const fs = require("fs");
const {queryHistoricalFeeds} = require("./query-arweave");
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRPC = config.jsonRpc;
const EthDater = require("ethereum-block-by-date");
const Web3 = require('web3');
const web = new Web3(new Web3.providers.HttpProvider(jsonRPC));
const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

let factory = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

const fillTimestamps = (startTimestamp, timestampInterval, days) => {
    const timestamps = [];
    let timestamp;

    timestamp = startTimestamp;

    const limitTimestamp = timestamp + days * timestampInterval;

    // get timestamps
    while (timestamp < limitTimestamp) {
        timestamps.push(timestamp);
        timestamp += timestampInterval;
    }

    let data = {};
    data.timestamps = timestamps;
    data = JSON.stringify(data);

    fs.writeFileSync('timestamps.json', data);
}

const fillFailedTimestamps = (loanAddress) => {
    const file = fs.readFileSync('failed-loans.json', 'utf-8');
    const data = JSON.parse(file);

    const failed = data.failed[loanAddress];

    if (failed && failed.length > 0) {
        let json = {};
        json.timestamps = data.failed[loanAddress];
        json = JSON.stringify(json);

        fs.writeFileSync('timestamps.json', json);
    }
}

const fetchLoanAddresses = async () => {
    const loanAddresses = await factory.getAllLoans();

    let data = {};
    data.addresses = loanAddresses;
    const result = JSON.stringify(data);

    fs.writeFileSync('loan-addresses.json', result);
}

const fetchHistoricalPrices = async () => {
    const file = fs.readFileSync('timestamps.json', 'utf-8');
    let timestampsData = JSON.parse(file);

    const nodeAddress1 = '0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747';
    const nodeAddress2 = '0x2c59617248994D12816EE1Fa77CE0a64eEB456BF';
    const nodeAddress3 = '0x12470f7aBA85c8b81D63137DD5925D6EE114952b';

    const timestamps = timestampsData.timestamps;

    let json = {};

    for (let timestamp of timestamps) {
        json[timestamp] = [];

        const dater = new EthDater(web);

        let blockData = await dater.getDate(timestamp);

        let block = await provider.getBlock(blockData.block);

        let approxTimestamp = parseInt((block.timestamp / 10).toString()) * 10; //requirement for Redstone

        const feeds = await queryHistoricalFeeds(approxTimestamp, [nodeAddress1, nodeAddress2, nodeAddress3]);

        for (let obj of feeds) {

            let txId = obj.node.id;
            let url = `https://arweave.net/${txId}`;

            const response = await fetch(url);

            json[timestamp].push(await response.json());
        }
    }

    console.log(json)

    fs.writeFileSync('feeds.json', JSON.stringify(json));
}




//methods run
fillTimestamps(1683720000000, 24 * 3600 * 1000, 2);
// fillFailedTimestamps('0x19F9C63cC50D8DbCd268F59798F8854cDCF21eE5');
// fetchLoanAddresses();
// fetchHistoricalPrices();