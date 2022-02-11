const PoolTUP = artifacts.require("./PoolTUP.sol");
const PangolinExchangeTUP = artifacts.require("./PangolinExchangeTUP.sol");
const execSync = require('child_process').execSync;

module.exports = async function(deployer) {
    let output1 = execSync(`node -r esm -e "require('./tools/scripts/update-smart-loan-properties.js')` +
        `.updateContracts('${PoolTUP.address.toString()}','${PangolinExchangeTUP.address.toString()}')"`, { encoding: 'utf-8' });
    console.log(output1);
    const output2 = execSync('truffle compile --all', { encoding: 'utf-8' });
    console.log(output2);
    const SmartLoan = artifacts.require("./SmartLoan.sol");
    await deployer.deploy(SmartLoan);
    console.log(`Deployed SmartLoan implementation contract at: ${SmartLoan.address}`);
};