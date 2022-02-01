const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const Pool = artifacts.require("./Pool.sol");

module.exports = async function(deployer) {
  const poolInstance = await deployProxy(Pool, { deployer: deployer, initializer: false });
  console.log(`Deployed Pool (TransparentUpgradeableProxy). Proxy address: ${poolInstance.address}`);
};
