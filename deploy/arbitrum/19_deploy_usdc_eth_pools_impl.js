import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import hre from "hardhat";
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("Pool", "./contracts");

    embedCommitHash("EthPool", "./contracts/deployment/arbitrum");
    embedCommitHash("UsdcPool", "./contracts/deployment/arbitrum");

    const ethPool = await deploy("EthPool", {
        contract: "contracts/deployment/arbitrum/EthPool.sol:EthPool",
        from: deployer,
        gasLimit: 20000000,
        args: [],
    });

    console.log(
        `Deployed EthPool at address: ${ethPool.address}`
    );

    await verifyContract(hre,
        {
            address: ethPool.address,
            contract: `contracts/deployment/arbitrum/EthPool.sol:EthPool`,
            constructorArguments: []
        });
    console.log(`Verified EthPool`);

    const usdcPool = await deploy("UsdcPool", {
        contract: "contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool",
        from: deployer,
        gasLimit: 20000000,
        args: [],
    });

    console.log(
        `Deployed UsdcPool at address: ${usdcPool.address}`
    );

    await verifyContract(hre,
        {
            address: usdcPool.address,
            contract: `contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool`,
            constructorArguments: []
        });
    console.log(`Verified UsdcPool`);

    // const ethPoolTUP = await ethers.getContract("EthPoolTUP", admin);
    // const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP", admin);
    //
    // await ethPoolTUP.upgradeTo(<INSERT ETH IMPL ADDRESS>);
    // await usdcPoolTUP.upgradeTo(<INSERT USDC IMPL ADDRESS>);
};


module.exports.tags = ["arbitrum-pool-1"];
