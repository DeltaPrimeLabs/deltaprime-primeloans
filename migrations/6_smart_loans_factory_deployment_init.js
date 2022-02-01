const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const AssetsExchange = artifacts.require("./PangolinExchange.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");
const SmartLoan = artifacts.require("./SmartLoan.sol");


module.exports = async function (deployer) {
    const smartLoansFactoryInstance = await deployProxy(SmartLoansFactory, [Pool.address, AssetsExchange.address, SmartLoan.address], { deployer: deployer})
    console.log(`Deployed SmartLoanFactory (TransparentUpgradeableProxy). Proxy address: ${smartLoansFactoryInstance.address}`);
    console.log(`Initialized with: [Pool: ${Pool.address}, AssetsExchange: ${AssetsExchange.address}, SmartLoan: ${SmartLoan.address}]`);
};
