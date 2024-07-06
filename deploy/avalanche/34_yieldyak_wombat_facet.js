import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    //
    // embedCommitHash("YieldYakWombatFacet", "./contracts/facets/avalanche");
    //
    // let YieldYakWombatFacet = await deploy("YieldYakWombatFacet", {
    //     from: deployer,
    //     gasLimit: 8000000,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `YieldYakWombatFacet implementation deployed at address: ${YieldYakWombatFacet.address}`
    // );

    await verifyContract(hre,
        {
            address: "0xf469C49b16C0BbCef6bA12cA6B31543D833640A7",
            contract: `contracts/facets/avalanche/YieldYakWombatFacet.sol:YieldYakWombatFacet`,
            constructorArguments: []
        });
    console.log(`Verified YieldYakWombatFacet`);
};

module.exports.tags = ["avalanche-yy-wombat-facet"];
