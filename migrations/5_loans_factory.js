const ZERO = require("ethers").constants.AddressZero;

const AssetsExchange = artifacts.require("./PangolinExchange.sol");
const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");


module.exports = function(deployer) {
  var factory;
  deployer.deploy(SmartLoansFactory, Pool.address, AssetsExchange.address)
    .then(function(instance) {
      factory = instance;
      console.log("Smart Loan factory deployed: " + factory.address);
      return Pool.deployed();
    }).then(function(pool) {
     console.log("Initializing pool: " + pool.address);
     return pool.initialize(VariableUtilisationRatesCalculator.address, factory.address, ZERO, ZERO, {gas:6000000});
  })

};
