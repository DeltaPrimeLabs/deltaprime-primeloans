import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    embedCommitHash("OwnershipFacet", "./contracts/facets");

    const OwnershipFacet = await deploy("OwnershipFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(
        `OwnershipFacet deployed at address: ${OwnershipFacet.address}`
    );

    await verifyContract(hre,
        {
            address: OwnershipFacet.address,
            contract: `contracts/facets/OwnershipFacet.sol:OwnershipFacet`,
            constructorArguments: []
        });
    console.log(`Verified OwnershipFacet`);
};

module.exports.tags = ["arbitrum-ownership-facet"];
