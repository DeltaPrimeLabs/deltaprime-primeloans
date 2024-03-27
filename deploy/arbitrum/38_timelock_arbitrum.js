import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const ARBITRUM_OWNER_MULTISIG = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD";
    const MINIMUM_DELAY = 24 * 60 * 60; // 1 day

    let TimeLock = await deploy("Timelock", {
        from: deployer,
        gasLimit: 100000000,
        args: [
            ARBITRUM_OWNER_MULTISIG,
            MINIMUM_DELAY,
        ],
    });


    console.log(
        `TimeLock implementation deployed at address: ${TimeLock.address}`
    );

    await verifyContract(hre,
        {
            address: TimeLock.address,
            contract: `contracts/TimeLock.sol:Timelock`,
            constructorArguments: [
                ARBITRUM_OWNER_MULTISIG,
                MINIMUM_DELAY,
            ]
        });
    console.log(`Verified TimeLock`);
};

module.exports.tags = ["arbitrum-timelock"];
