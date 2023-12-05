import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
const web3Abi  = require('web3-eth-abi');
const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("GmxV2FacetAvalanche", "./contracts/facets/avalanche");
    // // embedCommitHash("SolvencyFacetProdAvalanche", "./contracts/facets/avalanche");
    // // embedCommitHash("AssetsOperationsAvalancheFacet", "./contracts/facets/avalanche");
    // // embedCommitHash("SmartLoanViewFacet", "./contracts/facets");
    //
    // // let SmartLoanViewFacet = await deploy("SmartLoanViewFacet", {
    // //     from: deployer,
    // //     gasLimit: 15000000,
    // //     gasPrice: 450000000000,
    // //     args: [],
    // // });
    // //
    // //
    // // console.log(
    // //     `SmartLoanViewFacet implementation deployed at address: ${SmartLoanViewFacet.address}`
    // // );
    // //
    // // await verifyContract(hre,
    // //     {
    // //         address: SmartLoanViewFacet.address,
    // //         contract: `contracts/facets/SmartLoanViewFacet.sol:SmartLoanViewFacet`,
    // //         constructorArguments: []
    // //     });
    // // console.log(`Verified SmartLoanViewFacet`);
    //
    // let GmxV2FacetAvalanche = await deploy("GmxV2FacetAvalanche", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     gasPrice: 450000000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `GmxV2FacetAvalanche implementation deployed at address: ${GmxV2FacetAvalanche.address}`
    // );

    await verifyContract(hre,
        {
            address: "0x8C027824032e7FbD9A1EF47975aaB8D84211Fd1a",
            contract: `contracts/facets/avalanche/GmxV2FacetAvalanche.sol:GmxV2FacetAvalanche`,
            constructorArguments: []
        });
    console.log(`Verified GmxV2FacetAvalanche`);



    // let SolvencyFacetProdAvalanche = await deploy("SolvencyFacetProdAvalanche", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     gasPrice: 400000000000,
    //     args: [],
    // });
    //
    // console.log(
    //     `SolvencyFacetProdAvalanche implementation deployed at address: ${SolvencyFacetProdAvalanche.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: SolvencyFacetProdAvalanche.address,
    //         contract: `contracts/facets/avalanche/SolvencyFacetProdAvalanche.sol:SolvencyFacetProdAvalanche`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified SolvencyFacetProdAvalanche`);
    //
    //
    // let AssetsOperationsAvalancheFacet = await deploy("AssetsOperationsAvalancheFacet", {
    //     from: deployer,
    //     gasLimit: 15000000,
    //     gasPrice: 400000000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `AssetsOperationsAvalancheFacet implementation deployed at address: ${AssetsOperationsAvalancheFacet.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: AssetsOperationsAvalancheFacet.address,
    //         contract: `contracts/facets/avalanche/AssetsOperationsAvalancheFacet.sol:AssetsOperationsAvalancheFacet`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified AssetsOperationsAvalancheFacet`);

};

module.exports.tags = ["avax-gmx-v2"];
