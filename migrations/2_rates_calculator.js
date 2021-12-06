var VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");

module.exports = function(deployer) {
  deployer.deploy(VariableUtilisationRatesCalculator);
};
