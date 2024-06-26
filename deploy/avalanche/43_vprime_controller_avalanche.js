import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import vPrimeControllerArtifact from "../../artifacts/contracts/token/vPrimeControllerAvalanche.sol/vPrimeControllerAvalanche.json";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";
import web3Abi from "web3-eth-abi";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    embedCommitHash("vPrimeControllerAvalanche", "./contracts/token");
    let vPrimeControllerAvalanche = await deploy("vPrimeControllerAvalanche", {
        from: deployer,
        gasLimit: 15000000,
        args: [],
    });

    
    console.log(
        `vPrimeControllerAvalanche deployed at address: ${vPrimeControllerAvalanche.address}`
    );

    await verifyContract(hre,
        {
            address: vPrimeControllerAvalanche.address,
            contract: `contracts/token/vPrimeControllerAvalanche.sol:vPrimeControllerAvalanche`,
            constructorArguments: []
        });
    console.log(`Verified vPrimeControllerAvalanche`);

    const calldata = web3Abi.encodeFunctionCall(
        vPrimeControllerArtifact.abi.find((method) => method.name === "initialize"),
        [["0xa4306C384Ed015235E2B19ACcd3096045527A36f"], "0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e", "0x852894a93c9DA9f42a7e93dc47ef1c9630D58Bab", false]
    );

    let deployedvPrimeControllerTUP = await deploy("vPrimeControllerUP", {
        from: deployer,
        gasLimit: 15000000,
        args: [vPrimeControllerAvalanche.address, admin, calldata],
      });
    
      const vPrimeControllerTUP = await ethers.getContractAt(
        "vPrimeControllerAvalanche",
        deployedvPrimeControllerTUP.address
      );
    
      console.log(
        `Deployed vPrimeControllerUP at address: ${vPrimeControllerTUP.address}`
      );

};

module.exports.tags = ["avalanche-vprime-controller"];
