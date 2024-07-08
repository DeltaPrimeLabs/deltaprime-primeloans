import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const ARBITRUM_OWNER_MULTISIG = "0xDfA6706FC583b635CD6daF0E3915901A2fBaBAaD";
    const ARBITRUM_COL_MULTISIG = "0xAABabE8120f2568fC87d4668A5e31213DDA3C25A";
    const INITIAL_DELAY = 60 * 15; // 15 minutes

    const constructorArgs = [
        ARBITRUM_COL_MULTISIG,
        INITIAL_DELAY,
    ];

    let TimeLock = await deploy("Timelock", {
        from: deployer,
        gasLimit: 100000000,
        args: constructorArgs,
    });


    console.log(
        `TimeLock implementation deployed at address: ${TimeLock.address}`
    );

    await verifyContract(hre,
        {
            address: TimeLock.address,
            contract: `contracts/TimeLock.sol:Timelock`,
            constructorArguments: constructorArgs,
        });
    console.log(`Verified TimeLock`);
};

module.exports.tags = ["arbitrum-timelock"];
