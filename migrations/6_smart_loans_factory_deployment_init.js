const web3Abi  = require('web3-eth-abi');
const PangolinExchangeTUP = artifacts.require("./PangolinExchangeTUP.sol");
const PoolTUP = artifacts.require("./PoolTUP.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");
const SmartLoan = artifacts.require("./SmartLoan.sol");
const SmartLoansFactoryTUP = artifacts.require("./SmartLoansFactoryTUP.sol");

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(SmartLoansFactory);
    console.log(`Deployed SmartLoansFactory implementation contract at address: ${SmartLoansFactory.address}`);

    const calldata = web3Abi.encodeFunctionCall(
        SmartLoansFactory._json.abi.find(obj => obj.name === "initialize"),
        [SmartLoan.address]
    )

    await deployer.deploy(SmartLoansFactoryTUP, SmartLoansFactory.address, accounts[1], calldata);
    console.log(`Deployed SmartLoansFactory (TransparentUpgradeableProxy). Proxy address: ${SmartLoansFactoryTUP.address}`);
    console.log(`Initialized with: [Pool: ${PoolTUP.address}, AssetsExchange: ${PangolinExchangeTUP.address}, SmartLoan: ${SmartLoan.address}]`);
};
