const {ethers} = require("hardhat");
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
const usdcTokenAddress = "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664";

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    await initPool(deploy, deployer, "VariableUtilisationRatesCalculator", "WavaxPoolTUP", "WavaxDepositIndexTUP", "WavaxBorrowIndexTUP", WAVAXTokenAddress);
    await initPool(deploy, deployer, "VariableUtilisationRatesCalculator", "UsdcPoolTUP", "UsdcDepositIndexTUP", "UsdcBorrowIndexTUP",usdcTokenAddress);
};

async function initPool(deploy, deployer, ratesCalculator, poolTup, depositIndex, borrowIndex, tokenAddress) {
    const poolTUP = await ethers.getContract(poolTup);
    const pool = await ethers.getContractFactory("ERC20Pool");
    const variableUtilisationRatesCalculator = await ethers.getContract(ratesCalculator);
    const smartLoansFactoryTUP = await ethers.getContract("SmartLoansFactoryTUP");
    const depositIndexTUP = await ethers.getContract(depositIndex);
    const borrowIndexTUP = await ethers.getContract(borrowIndex);

    let initializeTx = await pool.attach(poolTUP.address).initialize(
        variableUtilisationRatesCalculator.address,
        smartLoansFactoryTUP.address,
        depositIndexTUP.address,
        borrowIndexTUP.address,
        tokenAddress,
        { gasLimit: 8000000 }
    );

    await initializeTx.wait();

    console.log(`Initialized lending pool with: [ratesCalculator: ${variableUtilisationRatesCalculator.address}, ` +
        `borrowersRegistry: ${smartLoansFactoryTUP.address}, depositIndex: ${depositIndexTUP.address}, borrowIndex: ${borrowIndexTUP.address}].
    tokenAddress: ${tokenAddress}`);
}

module.exports.tags = ['init'];
