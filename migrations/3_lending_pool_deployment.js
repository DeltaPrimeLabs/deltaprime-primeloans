const Pool = artifacts.require("./Pool.sol");
const PoolTUP = artifacts.require("./PoolTUP.sol");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(Pool);
  console.log(`Deployed Pool implementation contract at address: ${Pool.address}`);

  await deployer.deploy(PoolTUP, Pool.address, accounts[1], []);
  console.log(`Deployed Pool (TransparentUpgradeableProxy). Proxy address: ${PoolTUP.address}`);
};
