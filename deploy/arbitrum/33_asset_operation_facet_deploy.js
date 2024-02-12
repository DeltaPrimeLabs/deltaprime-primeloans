import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("AssetsOperationsFacet", "./contracts/facets");

    let AssetsOperationsFacet = await deploy("AssetsOperationsFacet", {
        from: deployer,
        gasLimit: 80000000,
        args: [],
    });

    console.log(
        `AssetsOperationsFacet implementation deployed at address: ${AssetsOperationsFacet.address}`
    );

    await verifyContract(hre,
        {
            address: AssetsOperationsFacet.address,
            contract: `contracts/facets/AssetsOperationsFacet.sol:AssetsOperationsFacet`,
            constructorArguments: []
        });
    console.log(`Verified AssetsOperationsFacet`);
};

module.exports.tags = ["arbitrum-asset-operation"];
