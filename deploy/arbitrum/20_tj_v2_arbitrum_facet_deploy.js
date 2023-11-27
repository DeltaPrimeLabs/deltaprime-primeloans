import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("TraderJoeV2ArbitrumFacet", "./contracts/facets/arbitrum");
    embedCommitHash("TraderJoeV2Facet", "./contracts/facets");

    let TraderJoeV2ArbitrumFacet = await deploy("TraderJoeV2ArbitrumFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `TraderJoeV2ArbitrumFacet implementation deployed at address: ${TraderJoeV2ArbitrumFacet.address}`
    );

    await verifyContract(hre,
        {
            address: TraderJoeV2ArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/TraderJoeV2ArbitrumFacet.sol:TraderJoeV2ArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified TraderJoeV2ArbitrumFacet`);
};

module.exports.tags = ["arbitrum-tjv2"];
