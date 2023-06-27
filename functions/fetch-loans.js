const fs = require("fs");
const childProcess = require('child_process');

const file = fs.readFileSync('loan-addresses.json', "utf-8");

const data = JSON.parse(file);

const loanAddresses = data.addresses;
console.log(0)

loanAddresses.forEach(address =>
    childProcess.fork("fetch-loan.js", [address])
);
