import {embedCommitHash} from "../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import hre from 'hardhat'
const networkName = hre.network.name
import createMigrationFile from "../tools/scripts/create-migration-file"
import verifyContract from "../tools/scripts/verify-contract";

module.exports = async ({
  getNamedAccounts,
  deployments
  }) => {
  const {deploy} = deployments;
  const {deployer, admin} = await getNamedAccounts();

  embedCommitHash('Pool', './contracts');
  embedCommitHash('WavaxPool', './contracts');
  embedCommitHash('UsdcPool', './contracts');
  embedCommitHash('WavaxPoolTUP', './contracts/proxies');
  embedCommitHash('UsdcPoolTUP', './contracts/proxies');

  await deployPool(deploy, deployer, admin, 'WavaxPool', 'WavaxPoolFactory', 'WavaxPoolTUP');
  await deployPool(deploy, deployer, admin, 'UsdcPool', 'PoolFactory', 'UsdcPoolTUP');
};

async function deployPool(deploy, deployer, admin, contract, poolFactory, tup) {
  embedCommitHash(poolFactory, './contracts/deployment');
  embedCommitHash(contract, './contracts');
  embedCommitHash(tup, './contracts/proxies');

  let resultFactory = await deploy(poolFactory, {
    from: deployer,
    gasLimit: 8000000,
    args: []
  });

  await verifyContract(hre, {
    address: resultFactory.address
  });

  const factory = await ethers.getContract(poolFactory);


  const tx = await factory.deployPool();
  const receipt = await tx.wait();
  let poolAddress = receipt.events[0].args[0];

  await verifyContract(hre, {
    address: poolAddress
  });

  console.log(`Pool deployed at address: ${poolAddress} by a factory`);

  createMigrationFile(networkName, contract, poolAddress, receipt.transactionHash);

  let result = await deploy(tup, {
    from: deployer,
    gasLimit: 8000000,
    args: [poolAddress, admin, []],
  });

  await verifyContract(hre, {
    address: result.address,
    contract: `contracts/proxies/${tup}.sol:${tup}`,
    constructorArguments: [
      poolAddress,
      admin,
      []
    ]
  });

  console.log(`${tup} deployed at address: ${result.address}`);
}

module.exports.tags = ['init'];
