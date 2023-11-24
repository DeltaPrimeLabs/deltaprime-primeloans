import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("GmxV2FacetArbitrum", "./contracts/facets/arbitrum");
    embedCommitHash("SolvencyFacetProdArbitrum", "./contracts/facets/arbitrum");
    embedCommitHash("AssetsExposureController", "./contracts/facets");
    embedCommitHash("AssetsOperationsArbitrumFacet", "./contracts/facets/arbitrum");
    embedCommitHash("SmartLoanViewFacet", "./contracts/facets");

    let GmxV2FacetArbitrum = await deploy("GmxV2FacetArbitrum", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });


    console.log(
        `GmxV2FacetArbitrum implementation deployed at address: ${GmxV2FacetArbitrum.address}`
    );

    await verifyContract(hre,
        {
            address: GmxV2FacetArbitrum.address,
            contract: `contracts/facets/arbitrum/GmxV2FacetArbitrum.sol:GmxV2FacetArbitrum`,
            constructorArguments: []
        });
    console.log(`Verified GmxV2FacetArbitrum`);



    let SolvencyFacetProdArbitrum = await deploy("SolvencyFacetProdArbitrum", {
        from: deployer,
        gasLimit: 100000000,
        args: [],
    });

    console.log(
        `SolvencyFacetProdArbitrum implementation deployed at address: ${SolvencyFacetProdArbitrum.address}`
    );

    await verifyContract(hre,
        {
            address: SolvencyFacetProdArbitrum.address,
            contract: `contracts/facets/arbitrum/SolvencyFacetProdArbitrum.sol:SolvencyFacetProdArbitrum`,
            constructorArguments: []
        });
    console.log(`Verified SolvencyFacetProdArbitrum`);



    let AssetsExposureController = await deploy("AssetsExposureController", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(
        `AssetsExposureController implementation deployed at address: ${AssetsExposureController.address}`
    );

    await verifyContract(hre,
        {
            address: AssetsExposureController.address,
            contract: `contracts/facets/AssetsExposureController.sol:AssetsExposureController`,
            constructorArguments: []
        });
    console.log(`Verified AssetsExposureController`);

    let AssetsOperationsArbitrumFacet = await deploy("AssetsOperationsArbitrumFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `AssetsOperationsArbitrumFacet implementation deployed at address: ${AssetsOperationsArbitrumFacet.address}`
    );

    await verifyContract(hre,
        {
            address: AssetsOperationsArbitrumFacet.address,
            contract: `contracts/facets/arbitrum/AssetsOperationsArbitrumFacet.sol:AssetsOperationsArbitrumFacet`,
            constructorArguments: []
        });
    console.log(`Verified AssetsOperationsArbitrumFacet`);

    let SmartLoanViewFacet = await deploy("SmartLoanViewFacet", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });


    console.log(
        `SmartLoanViewFacet implementation deployed at address: ${SmartLoanViewFacet.address}`
    );

    await verifyContract(hre,
        {
            address: SmartLoanViewFacet.address,
            contract: `contracts/facets/SmartLoanViewFacet.sol:SmartLoanViewFacet`,
            constructorArguments: []
        });
    console.log(`Verified SmartLoanViewFacet`);

};

module.exports.tags = ["arbi-gmx-v2"];
