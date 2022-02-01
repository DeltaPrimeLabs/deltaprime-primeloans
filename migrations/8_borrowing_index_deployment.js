const Pool = artifacts.require("./Pool.sol");
const BorrowingIndex = artifacts.require("./BorrowingIndex.sol");


module.exports = async function (deployer) {
    await deployer.deploy(BorrowingIndex, Pool.address);
    console.log('Deployed borrowingIndex at address: ', BorrowingIndex.address);
    console.log(`Initialized with: [Pool: ${Pool.address}]`)
};