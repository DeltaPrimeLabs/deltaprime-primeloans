import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("DepositSwapArbitrum");

    let depositSwapArbitrum = await deploy("DepositSwapArbitrum", {
        from: deployer,
        gasLimit: 50000000,
        args: [],
    });

    console.log(`Deployed DepositSwapArbitrum at address: ${depositSwapArbitrum.address}`);

    await verifyContract(hre, {
        address: depositSwapArbitrum.address,
        contract: "contracts/DepositSwapArbitrum.sol:DepositSwapArbitrum"
    })

    console.log('Verified DepositSwapArbitrum.')

    let depositSwapArbitrumTUP = await deploy("DepositSwapArbitrumTUP", {
        from: deployer,
        gasLimit: 50000000,
        args: [depositSwapArbitrum.address, admin, []],
    });

    console.log(
        `Deployed DepositSwapArbitrumTUP at address: ${depositSwapArbitrumTUP.address}`
    );

    await verifyContract(hre, {
        address: depositSwapArbitrumTUP.address,
        contract: "contracts/proxies/tup/arbitrum/DepositSwapArbitrumTUP.sol:DepositSwapArbitrumTUP",
        constructorArguments: [depositSwapArbitrum.address, admin, []]
    })

    console.log('Verified DepositSwapArbitrumTUP.')
};

module.exports.tags = ["arbitrum-deposit-swap"];
