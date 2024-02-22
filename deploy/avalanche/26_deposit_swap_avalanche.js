import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("DepositSwap");

    let depositSwap = await deploy("DepositSwap", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    console.log(`Deployed DepositSwap at address: ${depositSwap.address}`);

    await verifyContract(hre, {
        address: depositSwap.address,
        contract: "contracts/DepositSwap.sol:DepositSwap"
    })

    console.log('Verified DepositSwap.')
};

module.exports.tags = ["avalanche-deposit-swap"];
