const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const ZERO = require("ethers").constants.AddressZero;
const AssetsExchange = artifacts.require("./PangolinExchange.sol");
const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");


module.exports = async function (deployer) {
    const instance = await deployProxy(SmartLoansFactory, [Pool.address, AssetsExchange.address], { deployer: deployer})
    console.log(`SmartLoanFactory deployed [${instance.address}] and initialized with [${Pool.address}, ${AssetsExchange.address}]`);

    console.log(`Initializing Pool: [${VariableUtilisationRatesCalculator.address}, ${instance.address}, ${ZERO}, ${ZERO}]`);
    (await Pool.deployed()).initialize(VariableUtilisationRatesCalculator.address, instance.address, ZERO, ZERO, {gas: 6000000});

};
