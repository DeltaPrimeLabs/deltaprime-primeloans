import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("Pool", "./contracts");

    embedCommitHash("EthPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("UsdcPool", "./contracts/deployment/arbitrum");

    const ethPool = await deploy("WethPool", {
        contract: "contracts/deployment/arbitrum/WethPool.sol:WethPool",
        from: deployer,
        gasLimit: 20000000,
        args: [],
    });

    console.log(
        `Deployed WethPool at address: ${ethPool.address}`
    );

    await verifyContract(hre,
        {
            address: ethPool.address,
            contract: `contracts/deployment/arbitrum/WethPool.sol:WethPool`,
            constructorArguments: []
        });
    console.log(`Verified WethPool`);

    // const usdcPool = await deploy("UsdcPool", {
    //     contract: "contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool",
    //     from: deployer,
    //     gasLimit: 20000000,
    //     args: [],
    // });
    //
    // console.log(
    //     `Deployed UsdcPool at address: ${usdcPool.address}`
    // );
    //
    // await verifyContract(hre,
    //     {
    //         address: usdcPool.address,
    //         contract: `contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified UsdcPool`);

    const ethPoolTUP = await ethers.getContract("WethPoolTUP", admin);
    // const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP", admin);

    await ethPoolTUP.upgradeTo(ethPool.address);
    // await usdcPoolTUP.upgradeTo("0xEaf5a4259D8c9828c46Eb87b4801D7caDcEF340f");
};


module.exports.tags = ["arbitrum-pool-1"];
