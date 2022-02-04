const SmartLoan = artifacts.require("./SmartLoan.sol");
const execSync = require('child_process').execSync;

module.exports = async function(deployer) {
    const output1 = execSync('node -r esm ./tools/scripts/update-smart-loan-properties.js', { encoding: 'utf-8' });
    console.log(output1);
    const output2 = execSync('truffle compile --all', { encoding: 'utf-8' });
    console.log(output2);
    await deployer.deploy(SmartLoan);
    console.log(`Deployed SmartLoan implementation contract at: ${SmartLoan.address}`);
};