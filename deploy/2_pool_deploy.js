const {ethers} = require("hardhat");
import hre from 'hardhat'
const networkName = hre.network.name
import createMigrationArtifact from "../tools/scripts/create-migration-artifact"

module.exports = async ({
  getNamedAccounts,
  deployments
}) => {
  const {deploy} = deployments;
  const {deployer, admin} = await getNamedAccounts();

  await deploy('PoolFactory', {
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });


  const factory = await ethers.getContract("PoolFactory");

  const tx = await factory.deployPool();
  const receipt = await tx.wait();
  let poolAddress = receipt.events[0].args[0];

  console.log(`Pool deployed at address: ${poolAddress} by a factory`);

  createMigrationArtifact(networkName, './artifacts/contracts/Pool.sol/Pool.json', `./deployments/${networkName}/Pool.json`, poolAddress, receipt.transactionHash);

  let result = await deploy('PoolTUP', {
    from: deployer,
    gasLimit: 8000000,
    args: [poolAddress, admin, []],
  });

  console.log(`PoolTUP deployed at address: ${result.address}`);

};

module.exports.tags = ['init'];
