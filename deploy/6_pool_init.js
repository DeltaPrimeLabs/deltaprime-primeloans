import {embedCommitHash} from "../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import createMigrationFile from "../tools/scripts/create-migration-file";
import hre from 'hardhat';
import verifyContract from "../tools/scripts/verify-contract";
const networkName = hre.network.name;

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('CompoundingIndexFactory', './contracts/deployment');
    embedCommitHash('CompoundingIndex');

    let resultFactory = await deploy('CompoundingIndexFactory', {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: resultFactory.address
    })

    const compoundingIndexFactory = await ethers.getContract("CompoundingIndexFactory");
    const poolTUP = await ethers.getContract("PoolTUP");
    const pool = await ethers.getContractFactory("Pool");
    const variableUtilisationRatesCalculator = await ethers.getContract("VariableUtilisationRatesCalculator");
    const smartLoansFactoryTUP = await ethers.getContract("SmartLoansFactoryTUP");

    let txDepositIndex = await compoundingIndexFactory.deployIndex(poolTUP.address);
    const receiptDeposit = await txDepositIndex.wait();

    let depositIndexAddress = receiptDeposit.events[2].args[0];

    createMigrationFile(networkName, 'DepositIndex', depositIndexAddress, receiptDeposit.transactionHash);

    await verifyContract(hre, {
        address: depositIndexAddress,
        constructorArguments: [
            poolTUP.address
        ]
    })

    let txBorrowIndex = await compoundingIndexFactory.deployIndex(poolTUP.address);
    const receiptBorrow = await txBorrowIndex.wait();

    let borrowIndexAddress = receiptBorrow.events[2].args[0];

    createMigrationFile(networkName, 'BorrowIndex', borrowIndexAddress, receiptBorrow.transactionHash);

    await verifyContract(hre, {
        address: borrowIndexAddress,
        constructorArguments: [
            poolTUP.address
        ]
    })

    await pool.attach(poolTUP.address).initialize(
        variableUtilisationRatesCalculator.address,
        smartLoansFactoryTUP.address,
        depositIndexAddress,
        borrowIndexAddress
    );

    console.log(`Initialized lending pool with: [ratesCalculator: ${variableUtilisationRatesCalculator.address}, ` +
    `borrowersRegistry: ${smartLoansFactoryTUP.address}, depositIndex: ${depositIndexAddress}, borrowIndex: ${borrowIndexAddress}]`);

};

module.exports.tags = ['init'];
