import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("RemoveOwnedAssetsFacet", "./contracts/facets");

    let RemoveOwnedAssetsFacet = await deploy("RemoveOwnedAssetsFacet", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });


    console.log(
        `RemoveOwnedAssetsFacet implementation deployed at address: ${RemoveOwnedAssetsFacet.address}`
    );

    await verifyContract(hre,
        {
            address: RemoveOwnedAssetsFacet.address,
            contract: `contracts/facets/RemoveOwnedAssetsFacet.sol:RemoveOwnedAssetsFacet`,
            constructorArguments: []
        });
    console.log(`Verified RemoveOwnedAssetsFacet`);
};

module.exports.tags = ["remove-oa"];
