const {embedCommitHash} = require("../tools/scripts/embed-commit-hash");
module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  embedCommitHash('VariableUtilisationRatesCalculator');

  let result = await deploy('VariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });
  console.log(`Deployed VariableUtilisationRatesCalculator at address: ${result.address}`);
};

module.exports.tags = ['init'];
