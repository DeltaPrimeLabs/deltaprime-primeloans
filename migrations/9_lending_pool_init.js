const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");
const DepositIndex = artifacts.require("./DepositIndex.sol");
const BorrowingIndex = artifacts.require("./BorrowingIndex.sol");

module.exports = async function (deployer) {
    (await Pool.deployed()).initialize(
        VariableUtilisationRatesCalculator.address,
        SmartLoansFactory.address,
        DepositIndex.address,
        BorrowingIndex.address,
        {gas: 6000000});
    console.log(`Initialized lending pool with: [ratesCalculator: ${VariableUtilisationRatesCalculator.address}, borrowersRegistry: ${SmartLoansFactory.address}, depositIndex: ${DepositIndex.address}, borrowIndex: ${BorrowingIndex.address}]`);
};