const fs = require("fs");
const {uploadLoanStatuses} = require("./fetch-loan");
const timestamps = require('./timestamps.json');

const file = fs.readFileSync('loan-addresses.json', "utf-8");

const data = JSON.parse(file);

const loanAddresses = data.addresses;
const totalLoans = loanAddresses.length;
console.log("..........starting...........")

const batchSize = 150;

console.log(timestamps.timestamps);

async function fetchLoanHistory () {

    for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
        console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);
        const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);

        await Promise.all(
            batchLoanAddresses.map(async loanAddress => {
                await uploadLoanStatuses(loanAddress, timestamps.timestamps)
            })
        )
    }
}

fetchLoanHistory();