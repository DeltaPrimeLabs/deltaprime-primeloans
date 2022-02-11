const VariableUtilisationRatesCalculator = artifacts.require("./VariableUtilisationRatesCalculator.sol");
const PoolTUP = artifacts.require("./PoolTUP.sol");
const Pool = artifacts.require("./Pool.sol");
const SmartLoansFactoryTUP = artifacts.require("./SmartLoansFactoryTUP.sol");
const CompoundingIndexFactory = artifacts.require("./CompoundingIndexFactory.sol");

module.exports = async function (deployer) {
    await deployer.deploy(CompoundingIndexFactory);
    const factory = await CompoundingIndexFactory.deployed();

    let tx1 = await factory.deployIndex(PoolTUP.address);
    let depositIndexAddress = tx1.receipt.logs[0].args[0];

    let tx2 = await factory.deployIndex(PoolTUP.address);
    let borrowingIndexAddress = tx2.receipt.logs[0].args[0];

    (await Pool.at(PoolTUP.address)).initialize(
        VariableUtilisationRatesCalculator.address,
        SmartLoansFactoryTUP.address,
        depositIndexAddress,
        borrowingIndexAddress,
        {gas: 6000000});
    console.log(`Initialized lending pool with: [ratesCalculator: ${VariableUtilisationRatesCalculator.address}, borrowersRegistry: ${SmartLoansFactoryTUP.address}, depositIndex: ${depositIndexAddress}, borrowIndex: ${borrowingIndexAddress}]`);
};