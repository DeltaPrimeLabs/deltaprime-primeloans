const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const PoolTUP = artifacts.require("./PoolTUP.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactoryTUP = artifacts.require("./SmartLoansFactoryTUP.sol");
const DepositIndex = artifacts.require("./DepositIndex.sol");
const BorrowingIndex = artifacts.require("./BorrowingIndex.sol");

module.exports = async function (deployer, network, accounts) {
    (await Pool.at(PoolTUP.address)).initialize(
        VariableUtilisationRatesCalculator.address,
        SmartLoansFactoryTUP.address,
        DepositIndex.address,
        BorrowingIndex.address,
        {gas: 6000000});
    console.log(`Initialized lending pool with: [ratesCalculator: ${VariableUtilisationRatesCalculator.address}, borrowersRegistry: ${SmartLoansFactoryTUP.address}, depositIndex: ${DepositIndex.address}, borrowIndex: ${BorrowingIndex.address}]`);
};