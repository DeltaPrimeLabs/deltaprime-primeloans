import verifyContract from "../../tools/scripts/verify-contract";
const hre = require("hardhat");
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const contractName = 'DepositAccessNFT';
    let result = await deploy(contractName, {
        from: deployer,
        gasLimit: 8000000
    });

    await verifyContract(hre, {
        address: result.address
    });

    console.log(`Deployed ${contractName} implementation at address: ${result.address}`);
};

module.exports.tags = ['deploy-contract'];
