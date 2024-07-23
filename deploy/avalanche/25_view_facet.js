import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("SmartLoanViewFacet", "./contracts/facets");

    let SmartLoanViewFacet = await deploy("SmartLoanViewFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `SmartLoanViewFacet implementation deployed at address: ${SmartLoanViewFacet.address}`
    );

    // wait 10 seconds
    await new Promise((r) => setTimeout(r, 10000));

    await verifyContract(hre,
        {
            address: SmartLoanViewFacet.address,
            contract: `contracts/facets/SmartLoanViewFacet.sol:SmartLoanViewFacet`,
            constructorArguments: []
        });
    console.log(`Verified SmartLoanViewFacet`);
};

module.exports.tags = ["avalanche-view-facet"];
