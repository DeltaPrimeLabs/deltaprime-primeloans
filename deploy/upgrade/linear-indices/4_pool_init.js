import hre from 'hardhat';

const {ethers} = require("hardhat");
const networkName = hre.network.name;

module.exports = async ({
        getNamedAccounts,
    }) => {
    const {deployer} = await getNamedAccounts();

    const poolTUP = await ethers.getContract("PoolTUP");
    const pool = await ethers.getContractFactory("PoolWithAccessNFT");
    const variableUtilisationRatesCalculator = await ethers.getContract("VariableUtilisationRatesCalculator");
    const smartLoansFactoryTUP = await ethers.getContract("SmartLoansFactoryTUP");
    const depositIndexTUP = await ethers.getContract("DepositIndexTUP");
    const borrowIndexTUP = await ethers.getContract("BorrowIndexTUP");


    let initializeTx = await pool.attach(poolTUP.address).initialize(
        variableUtilisationRatesCalculator.address,
        smartLoansFactoryTUP.address,
        depositIndexTUP.address,
        borrowIndexTUP.address,
        { gasLimit: 8000000 }
    );

    await initializeTx.wait();

    console.log(`Initialized lending pool at ${poolTUP.address} with: [ratesCalculator: ${variableUtilisationRatesCalculator.address}, ` +
    `borrowersRegistry: ${smartLoansFactoryTUP.address}, depositIndex: ${depositIndexTUP.address}, borrowIndex: ${borrowIndexTUP.address}]`);

};

module.exports.tags = ['pool-init'];
