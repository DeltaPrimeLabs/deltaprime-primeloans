import hre, { ethers } from "hardhat";

const { embedCommitHash } = require("../../tools/scripts/embed-commit-hash");
import verifyContract from "../../tools/scripts/verify-contract";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    // embedCommitHash('Pool', './contracts');

    // embedCommitHash('EthPool', './contracts/deployment/avalanche');
    // embedCommitHash('BtcPool', './contracts/deployment/avalanche');
    // embedCommitHash('UsdcPool', './contracts/deployment/avalanche');
    // embedCommitHash('UsdtPool', './contracts/deployment/avalanche');
    // embedCommitHash('WavaxPool', './contracts/deployment/avalanche');

    let pools = {}

    let ethPool = await deploy("EthPool", {
        contract: "contracts/deployment/avalanche/EthPool.sol:EthPool",
        from: deployer,
        args: [],
    });

    pools["ETH"] = ethPool.address;
    console.log(`Deployed EthPool at address: ${ethPool.address}`);

    await new Promise(r => setTimeout(r, 5000));

    await verifyContract(hre,
        {
            address: ethPool.address,
            contract: `contracts/deployment/avalanche/EthPool.sol:EthPool`,
            constructorArguments: []
        });
    console.log(`Verified EthPool`)

    // let btcPool = await deploy("BtcPool", {
    //     contract: "contracts/deployment/avalanche/BtcPool.sol:BtcPool",
    //     from: deployer,
    //     args: [],
    // });
    //
    // pools["BTC"] = btcPool.address;
    // console.log(`Deployed BtcPool at address: ${btcPool.address}`);
    //
    // await new Promise(r => setTimeout(r, 5000));
    //
    // await verifyContract(hre,
    //     {
    //         address: "0x88499f0A211e74887e8352757db07bF2864Ac836",
    //         contract: `contracts/deployment/avalanche/BtcPool.sol:BtcPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified BtcPool`)
    //

    // let usdcPool = await deploy("UsdcPool", {
    //     contract: "contracts/deployment/avalanche/UsdcPool.sol:UsdcPool",
    //     from: deployer,
    //     args: [],
    // });
    //
    // pools["USDC"] = usdcPool.address;
    // console.log(`Deployed UsdcPool at address: ${usdcPool.address}`);
    //
    // await new Promise(r => setTimeout(r, 5000));

    // await verifyContract(hre,
    //     {
    //         address: "0x1904b2d7D624d70f2f00808c7F53Cd75b0e2E771",
    //         contract: `contracts/deployment/avalanche/UsdcPool.sol:UsdcPool`,
    //         constructorArguments: []
    //     });
    // console.log(`Verified UsdcPool`)

    let usdtPool = await deploy("UsdtPool", {
        contract: "contracts/deployment/avalanche/UsdtPool.sol:UsdtPool",
        from: deployer,
        args: [],
    });

    pools["USDT"] = usdtPool.address;
    console.log(`Deployed UsdtPool at address: ${usdtPool.address}`);

    await new Promise(r => setTimeout(r, 5000));

    await verifyContract(hre,
        {
            address: usdtPool.address,
            contract: `contracts/deployment/avalanche/UsdtPool.sol:UsdtPool`,
            constructorArguments: []
        });
    console.log(`Verified UsdtPool`)

    let wavaxPool = await deploy("WavaxPool", {
        contract: "contracts/deployment/avalanche/WavaxPool.sol:WavaxPool",
        from: deployer,
        args: [],
    });

    pools["WAVAX"] = wavaxPool.address;
    console.log(`Deployed WavaxPool at address: ${wavaxPool.address}`);

    await new Promise(r => setTimeout(r, 5000));

    await verifyContract(hre,
        {
            address: wavaxPool.address,
            contract: `contracts/deployment/avalanche/WavaxPool.sol:WavaxPool`,
            constructorArguments: []
        });
    console.log(`Verified WavaxPool`);

    console.log(Object.entries(pools))

};

module.exports.tags = ["avalanche-pools-update"];
