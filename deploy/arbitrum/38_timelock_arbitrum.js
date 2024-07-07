import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const ARBITRUM_OWNER_MULTISIG = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD";
    const ARBITRUM_COL_MULTISIG = "<PENDING>";
    const INITIAL_DELAY = 60 * 5; // 5 minutes

    let TimeLock = await deploy("Timelock", {
        from: deployer,
        gasLimit: 100000000,
        args: [
            ARBITRUM_OWNER_MULTISIG,
            INITIAL_DELAY,
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
                INITIAL_DELAY,
            ]
        });
    console.log(`Verified TimeLock`);
};

module.exports.tags = ["arbitrum-timelock"];
