import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("TraderJoeV2Facet", "./contracts/facets/avalanche");

    let TraderJoeV2Facet = await deploy("TraderJoeV2Facet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `TraderJoeV2Facet implementation deployed at address: ${TraderJoeV2Facet.address}`
    );

    await verifyContract(hre,
        {
            address: TraderJoeV2Facet.address,
            contract: `contracts/facets/avalanche/TraderJoeV2Facet.sol:TraderJoeV2Facet`,
            constructorArguments: []
        });
    console.log(`Verified TraderJoeV2Facet`);
};

module.exports.tags = ["avalanche-tjv2"];
