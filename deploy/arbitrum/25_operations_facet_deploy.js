import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import {ether} from "@openzeppelin/test-helpers";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    const FacetCutAction = {
        Add: 0,
        Replace: 1,
        Remove: 2
    }

    embedCommitHash("AssetsOperationsArbitrumFacet", "./contracts/facets/arbitrum");

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

    const diamondContract = await ethers.getContract("SmartLoanDiamondBeacon");
    console.log(`Diamond address: ${diamondContract.address}`);
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamondContract.address, deployer);

    let methodsSelectors = [
        "0xe46bbc9e",
        "0x040cf020",
        "0x7c93ec30",
        "0x00f989ad",
        "0xd66e2979",
        "0x9d9a355e",
        "0x1281f5fe"
    ];

    const facetCut = [
        [
            AssetsOperationsArbitrumFacet.address,
            FacetCutAction.Replace,
            methodsSelectors
        ]
    ]

    console.log(`Performing diamondCut with: ${facetCut}`)
    await diamondCut.pause();
    console.log('Paused')
    await diamondCut.diamondCut(
        facetCut,
        ethers.constants.AddressZero,
        []
    )
    await diamondCut.unpause();
    console.log('Unpaused')
    console.log(`DiamondCut finished`)
};

module.exports.tags = ["arbitrum-operations-facet"];
