const {deployProxy} = require('@openzeppelin/truffle-upgrades');
const ZERO = require("ethers").constants.AddressZero;
const AssetsExchange = artifacts.require("./PangolinExchange.sol");
const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");
const DepositIndex = artifacts.require("./DepositIndex.sol");
const BorrowingIndex = artifacts.require("./BorrowingIndex.sol");
const SmartLoan = artifacts.require("./SmartLoan.sol");


module.exports = async function (deployer) {
    await deployer.deploy(SmartLoan);
    const instance = await deployProxy(SmartLoansFactory, [Pool.address, AssetsExchange.address, SmartLoan.address], { deployer: deployer})
    console.log(`SmartLoanFactory deployed [${instance.address}] and initialized with [${Pool.address}, ${AssetsExchange.address}]`);

    console.log('Pool.address: ', Pool.address)
    await deployer.deploy(DepositIndex, Pool.address);
    await deployer.deploy(BorrowingIndex, Pool.address);

    console.log(`Initializing Pool: [${VariableUtilisationRatesCalculator.address}, ${instance.address}, ${DepositIndex.address}, ${BorrowingIndex.address}]`);
    (await Pool.deployed()).initialize(
        VariableUtilisationRatesCalculator.address,
        instance.address,
        DepositIndex.address,
        BorrowingIndex.address,
        {gas: 6000000});
};
