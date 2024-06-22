import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("DepositRewarder", "./contracts");

    const WavaxPoolTUPAddress = "0xD26E504fc642B96751fD55D3E68AF295806542f5";

    let DepositRewarder = await deploy("DepositRewarder", {
        from: deployer,
        args: [WavaxPoolTUPAddress],
    });


    console.log(
        `DepositRewarder implementation deployed at address: ${DepositRewarder.address}`
    );

    await verifyContract(hre,
        {
            address: DepositRewarder.address,
            contract: `contracts/DepositRewarder.sol:DepositRewarder`,
            constructorArguments: [WavaxPoolTUPAddress]
        });
    console.log(`Verified DepositRewarder`);
};

module.exports.tags = ["avalanche-deposit-rewarder"];
