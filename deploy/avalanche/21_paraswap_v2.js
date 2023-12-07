import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("ParaSwapFacet", "./contracts/facets/avalanche");
    //
    // let ParaSwapFacet = await deploy("ParaSwapFacet", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `ParaSwapFacet implementation deployed at address: ${ParaSwapFacet.address}`
    // );

    await verifyContract(hre,
        {
            address: "0x3d85B55CB005D2D5D499b531D9d60150f0d5a630",
            contract: `contracts/facets/avalanche/ParaSwapFacet.sol:ParaSwapFacet`,
            constructorArguments: []
        });
    console.log(`Verified ParaSwapFacet`);

};

module.exports.tags = ["avalanche-paraswap"];
