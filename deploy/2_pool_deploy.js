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

  embedCommitHash('PoolFactory', './contracts/deployment');
  embedCommitHash('Pool', './contracts');
  embedCommitHash('PoolTUP', './contracts/proxies');

  let resultFactory = await deploy('PoolFactory', {
    from: deployer,
    gasLimit: 8000000,
    args: [],
  });

  await verifyContract(hre, {
    address: resultFactory.address
  });

  const factory = await ethers.getContract("PoolFactory");


  const tx = await factory.deployPool();
  const receipt = await tx.wait();
  let poolAddress = receipt.events[0].args[0];

  await verifyContract(hre, {
    address: poolAddress
  });

  console.log(`Pool deployed at address: ${poolAddress} by a factory`);

  createMigrationFile(networkName,'Pool', poolAddress, receipt.transactionHash);

  let result = await deploy('PoolTUP', {
    from: deployer,
    gasLimit: 8000000,
    args: [poolAddress, admin, []],
  });

  await verifyContract(hre, {
    address: result.address,
    contract: "contracts/proxies/PoolTUP.sol:PoolTUP",
    constructorArguments: [
        poolAddress,
        admin,
        []
    ]
  });

  console.log(`PoolTUP deployed at address: ${result.address}`);

};

module.exports.tags = ['init'];
