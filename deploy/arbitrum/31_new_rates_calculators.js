import hre from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";
const {ethers} = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash(
        "ArbVariableUtilisationRatesCalculator",
        "./contracts/deployment/arbitrum"
    );

    let result = await deploy("ArbVariableUtilisationRatesCalculator", {
        contract: 'contracts/deployment/arbitrum/ArbVariableUtilisationRatesCalculator.sol:ArbVariableUtilisationRatesCalculator',
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `Deployed ArbVariableUtilisationRatesCalculator at address: ${result.address}`
    );

    await verifyContract(hre,
        {
            address: "0xD4a3606A8b3e7b5F9e95C51500452a4c532Cfc45",
            contract: `contracts/deployment/arbitrum/ArbVariableUtilisationRatesCalculator.sol:ArbVariableUtilisationRatesCalculator`,
            constructorArguments: []
        });
    console.log(`Verified ArbVariableUtilisationRatesCalculator`)
};

module.exports.tags = ["arbitrum-rates-calculator"];
