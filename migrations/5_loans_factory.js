const ZERO = require("ethers").constants.AddressZero;

const AssetsExchange = artifacts.require("./PangolinExchange.sol");
const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");


module.exports = function (deployer) {
    var factory;
    deployer.deploy(SmartLoansFactory)
        .then(function (instance) {
            factory = instance;
            console.log("SmartLoanFactory deployed: " + factory.address);
            factory.initialize(Pool.address, AssetsExchange.address);
            console.log(`Initializing SmartLoanFactory: [${Pool.address}, ${AssetsExchange.address}]`);
            return Pool.deployed();
        }).then(function (pool) {
        console.log(`Initializing Pool: [${VariableUtilisationRatesCalculator.address}, ${factory.address}, ${ZERO}, ${ZERO}]`);
        return pool.initialize(VariableUtilisationRatesCalculator.address, factory.address, ZERO, ZERO, {gas: 6000000});
    })

};
