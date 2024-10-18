import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // embedCommitHash("WethPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("UsdcPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("ArbPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("DaiPool", "./contracts/deployment/arbitrum");
    // embedCommitHash("BtcPool", "./contracts/deployment/arbitrum");

    // let WethPool = await deploy("WethPool", {
    //     from: deployer,
    //     args: [],
    // });

    
    // console.log(
    //     `WethPool deployed at address: ${WethPool.address}`
    // );

    // wait 5 seconds
    // await new Promise(r => setTimeout(r, 5000));

    // await verifyContract(hre,
    //     {
    //         address: WethPool.address,
    //         contract: `contracts/deployment/arbitrum/WethPool.sol:WethPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified WethPool`);


    // let UsdcPool = await deploy("UsdcPool", {
    //     contract: "contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool",
    //     from: deployer,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `UsdcPool deployed at address: ${UsdcPool.address}`
    // );
    //
    // // wait 5 seconds
    // await new Promise(r => setTimeout(r, 5000));
    //
    // await verifyContract(hre,
    //     {
    //         address: UsdcPool.address,
    //         contract: `contracts/deployment/arbitrum/UsdcPool.sol:UsdcPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified UsdcPool`);
    //
    //
    // let ArbPool = await deploy("ArbPool", {
    //     from: deployer,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `ArbPool deployed at address: ${ArbPool.address}`
    // );
    //
    // // wait 5 seconds
    // await new Promise(r => setTimeout(r, 5000));
    //
    // await verifyContract(hre,
    //     {
    //         address: ArbPool.address,
    //         contract: `contracts/deployment/arbitrum/ArbPool.sol:ArbPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified ArbPool`);
    //
    //
    // let DaiPool = await deploy("DaiPool", {
    //     from: deployer,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `DaiPool deployed at address: ${DaiPool.address}`
    // );
    //
    // // wait 5 seconds
    // await new Promise(r => setTimeout(r, 5000));
    //
    // await verifyContract(hre,
    //     {
    //         address: DaiPool.address,
    //         contract: `contracts/deployment/arbitrum/DaiPool.sol:DaiPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified DaiPool`);


    let BtcPool = await deploy("BtcPool", {
        contract: "contracts/deployment/arbitrum/BtcPool.sol:BtcPool",
        from: deployer,
        args: [],
    });


    console.log(
        `BtcPool deployed at address: ${BtcPool.address}`
    );

    // wait 5 seconds
    await new Promise(r => setTimeout(r, 5000));

    await verifyContract(hre,
        {
            address: BtcPool.address,
            contract: `contracts/deployment/arbitrum/BtcPool.sol:BtcPool`,
            constructorArguments: []
        });
    console.log(`Verified BtcPool`);



};

module.exports.tags = ["arbitrum-pools"];
