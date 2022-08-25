import verifyContract from "../../tools/scripts/verify-contract";

const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
import hre from 'hardhat'

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

  await verifyContract(hre, {
    address: result.address
  });


  console.log(`Deployed VariableUtilisationRatesCalculator at address: ${result.address}`);
};

module.exports.tags = ['avalanche'];
