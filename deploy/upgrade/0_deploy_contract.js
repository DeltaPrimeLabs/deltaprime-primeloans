import verifyContract from "../../tools/scripts/verify-contract";
import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
const hre = require("hardhat");
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    // IMPORTANT: Update contract's name and path accordingly before using the 0_deploy_contract.js script
    embedCommitHash('SmartLoanLimitedCollateral', './contracts/upgraded');
    const contractName = 'SmartLoanLimitedCollateral';
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
