const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");

module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  embedCommitHash('WavaxVariableUtilisationRatesCalculator');

  let result = await deploy('WavaxVariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  console.log(`Deployed WavaxVariableUtilisationRatesCalculator at address: ${result.address}`);

  embedCommitHash('UsdcVariableUtilisationRatesCalculator');

  result = await deploy('UsdcxVariableUtilisationRatesCalculator', {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  console.log(`Deployed UsdcVariableUtilisationRatesCalculator at address: ${result.address}`);
};

module.exports.tags = ['avalanche'];
