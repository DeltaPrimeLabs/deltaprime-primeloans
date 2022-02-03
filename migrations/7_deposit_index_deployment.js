const PoolTUP = artifacts.require("./PoolTUP.sol");
const DepositIndex = artifacts.require("./DepositIndex.sol");

module.exports = async function (deployer) {
    await deployer.deploy(DepositIndex, PoolTUP.address);
    console.log('Deployed depositIndex at address: ', DepositIndex.address);
    console.log(`Initialized with: [owner: ${PoolTUP.address}]`)
};