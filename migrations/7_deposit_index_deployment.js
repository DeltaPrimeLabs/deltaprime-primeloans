const Pool = artifacts.require("./Pool.sol");
const DepositIndex = artifacts.require("./DepositIndex.sol");

module.exports = async function (deployer) {
    await deployer.deploy(DepositIndex, Pool.address);
    console.log('Deployed depositIndex at address: ', DepositIndex.address);
    console.log(`Initialized with: [Pool: ${Pool.address}]`)
};