const SmartLoan = artifacts.require("./SmartLoan.sol");

module.exports = async function(deployer) {
    await deployer.deploy(SmartLoan);
    console.log(`Deployed SmartLoan implementation contract at: ${SmartLoan.address}`);
};