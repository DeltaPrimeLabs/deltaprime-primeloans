const PoolTUP = artifacts.require("./PoolTUP.sol");
const BorrowingIndex = artifacts.require("./BorrowingIndex.sol");


module.exports = async function (deployer) {
    await deployer.deploy(BorrowingIndex, PoolTUP.address);
    console.log('Deployed borrowingIndex at address: ', BorrowingIndex.address);
    console.log(`Initialized with: [owner: ${PoolTUP.address}]`)
};