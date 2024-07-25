import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const AVALANCHE_OWNER_MULTISIG = "0x44AfCcF712E8A097a6727B48b57c75d7A85a9B0c";
    const AVALANCHE_COL_MULTISIG = "0x3813f577Aedc5F26F36B8638EDbB949d169F7fDc";
    const INITIAL_DELAY = 60 * 15; // 15 minutes

    const constructorArgs = [
        AVALANCHE_COL_MULTISIG,
        INITIAL_DELAY,
    ];

    let TimeLock = await deploy("Timelock", {
        from: deployer,
        gasLimit: 15000000,
        args: constructorArgs,
    });


    console.log(
        `TimeLock implementation deployed at address: ${TimeLock.address}`
    );

    // sleep for 10 seconds to wait for the tx to be mined
    await new Promise((r) => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: TimeLock.address,
            contract: `contracts/TimeLock.sol:Timelock`,
            constructorArguments: constructorArgs,
        });
    console.log(`Verified TimeLock`);
};

module.exports.tags = ["avalanche-timelock"];
