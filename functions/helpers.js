const ethers = require("ethers");
const factoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const FACTORY = require(`./SmartLoansFactory.json`);
const fs = require("fs");

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRPC = config.jsonRpc;
const provider = new ethers.providers.JsonRpcProvider(jsonRPC);

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




//methods run
fillTimestamps(1683720000000, 24 * 3600 * 1000, 2);
// fillFailedTimestamps('0x19F9C63cC50D8DbCd268F59798F8854cDCF21eE5');
// fetchLoanAddresses();