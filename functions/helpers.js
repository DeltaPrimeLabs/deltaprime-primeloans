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


const checkMissingLoansData = () => {
    let missing = [];


    let moreThan10 = 0;
    let moreThan20 = 0;
    let moreThan30 = 0;

    let lessThan20Array = [];


    fs.readdirSync('./results/').forEach(name => {
        let file = fs.readFileSync('./results/' + name, 'utf-8');

        let json = JSON.parse(file);


        if (json.dataPoints.length >= 10) {
            moreThan10++;
        }

        if (json.dataPoints.length >= 20) {
            moreThan20++;
        } else {
            lessThan20Array.push(name.replace('.json',''));

        }
        if (json.dataPoints.length >= 30) {
            moreThan30++;
        }


        if (!json.dataPoints || json.dataPoints.length === 0) {
            missing.push(name.replace('.json',''))
        }
    });

    console.log('more than 10: ', moreThan10);
    console.log('more than 20: ', moreThan20);
    console.log('more than 30: ', moreThan30);

    console.log('less thatn 20: ', lessThan20Array.length);

    const missingJson = {};

    missingJson.addresses = missing;

    let json = {}
    json.addresses = lessThan20Array;

    fs.writeFileSync('left-loan-addresses.json', JSON.stringify(json));

    fs.writeFileSync('missing.json', JSON.stringify(missingJson))
}

const findNotFetchedAddresses = () => {
    let file = fs.readFileSync('loan-addresses.json', 'utf-8');

    let allAddresses = JSON.parse(file).addresses;

    let fetchedAddresses = [];
    let notFetchedAddresses = [];

    fs.readdirSync('./results/').forEach(name => {
        let address = name.replace('.json', '');

        fetchedAddresses.push(address);
    });

    allAddresses.forEach(address => {
        if (!fetchedAddresses.includes(address)) {
            notFetchedAddresses.push(address);
        }

    });

    let json = {}
    json.addresses = notFetchedAddresses;

    fs.writeFileSync('left-loan-addresses.json', JSON.stringify(json));

    console.log("not fetched: ", notFetchedAddresses.length);
}

//methods run
//checkMissingLoansData();
//findNotFetchedAddresses();
fillTimestamps(1683720000000, 24 * 3600 * 1000, 2);
// fillFailedTimestamps('0x19F9C63cC50D8DbCd268F59798F8854cDCF21eE5');
// fetchLoanAddresses();
// fetchHistoricalPrices();