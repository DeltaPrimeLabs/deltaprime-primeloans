var SmartLoan = artifacts.require("./SmartLoan.sol");

module.exports = function(deployer) {
  deployer.deploy(SmartLoan);
};
