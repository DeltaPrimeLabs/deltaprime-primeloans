const PoolFactory = artifacts.require("./PoolFactory.sol");
const PoolTUP = artifacts.require("./PoolTUP.sol");

module.exports = async function(deployer, accounts) {
  await deployer.deploy(PoolFactory);

  const factory = await PoolFactory.deployed();

  const tx = await factory.deployPool();
  let poolAddress = tx.receipt.logs[0].args[0];

  console.log(`Deployed Pool implementation by factory at address: ${poolAddress}`);

  await deployer.deploy(PoolTUP, poolAddress, accounts[1], []);
  console.log(`Deployed Pool (TransparentUpgradeableProxy). Proxy address: ${poolAddress}`);
};
