var DepositIndex = artifacts.require("./DepositIndex.sol");
var BorrowingIndex = artifacts.require("./BorrowingIndex.sol");
var Pool = artifacts.require("./Pool.sol");

module.exports = async function(deployer) {
  await deployer.deploy(DepositIndex, Pool.address);
  await deployer.deploy(BorrowingIndex, Pool.address);
};
