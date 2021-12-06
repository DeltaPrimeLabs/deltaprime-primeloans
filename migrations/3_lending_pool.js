const Pool = artifacts.require("./Pool.sol");

module.exports = function(deployer) {
  deployer.deploy(Pool);
};
