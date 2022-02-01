const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");

module.exports = async function(deployer) {
  await deployer.deploy(VariableUtilisationRatesCalculator);
  console.log(`Deployed VariableUtilisationRatesCalculator at address: ${VariableUtilisationRatesCalculator.address}`);
};
