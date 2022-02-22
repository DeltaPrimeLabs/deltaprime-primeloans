import {embedCommitHash} from "../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import createMigrationArtifact from "../tools/scripts/create-migration-artifact";
import hre from 'hardhat';
const networkName = hre.network.name;

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('CompoundingIndexFactory', './contracts/deployment');
    embedCommitHash('CompoundingIndex');

    await deploy('CompoundingIndexFactory', {
        from: deployer,
        gasLimit: 8000000
    });

    const compoundingIndexFactory = await ethers.getContract("CompoundingIndexFactory");
    const poolTUP = await ethers.getContract("PoolTUP");
    const pool = await ethers.getContractFactory("Pool");
    const variableUtilisationRatesCalculator = await ethers.getContract("VariableUtilisationRatesCalculator");
    const smartLoansFactoryTUP = await ethers.getContract("SmartLoansFactoryTUP");

    let txDepositIndex = await compoundingIndexFactory.deployIndex(poolTUP.address);
    const receiptDeposit = await txDepositIndex.wait();

    let depositIndexAddress = receiptDeposit.events[2].args[0];

    createMigrationArtifact(networkName, './artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json', `./deployments/${networkName}/DepositIndex.json`, depositIndexAddress, receiptDeposit.transactionHash);

    let txBorrowIndex = await compoundingIndexFactory.deployIndex(poolTUP.address);
    const receiptBorrow = await txBorrowIndex.wait();

    let borrowIndexAddress = receiptBorrow.events[2].args[0];

    createMigrationArtifact(networkName, './artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json', `./deployments/${networkName}/BorrowIndex.json`, borrowIndexAddress, receiptBorrow.transactionHash);

    await pool.attach(poolTUP.address).initialize(
        variableUtilisationRatesCalculator.address,
        smartLoansFactoryTUP.address,
        depositIndexAddress,
        borrowIndexAddress);



    console.log(`Initialized lending pool with: [ratesCalculator: ${variableUtilisationRatesCalculator.address}, ` +
    `borrowersRegistry: ${smartLoansFactoryTUP.address}, depositIndex: ${depositIndexAddress}, borrowIndex: ${borrowIndexAddress}]`);

};

module.exports.tags = ['init'];
