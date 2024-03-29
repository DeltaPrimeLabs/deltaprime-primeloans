import { parseEther } from "viem";
import { embedCommitHash } from "../../tools/scripts/embed-commit-hash";

const { ethers } = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

export const spotUniform = {
    deltaIds: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
    distributionX: [
      0, 0, 0, 0, 0, 0.090909, 0.181818, 0.181818, 0.181818, 0.181818, 0.181818
    ].map((el) => parseEther(`${el}`)),
    distributionY: [
      0.181818, 0.181818, 0.181818, 0.181818, 0.181818, 0.090909, 0, 0, 0, 0, 0
    ].map((el) => parseEther(`${el}`))
  }
  
  // 2) Curve
  export const curve = {
    deltaIds: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
    distributionX: [0, 0, 0, 0, 0, 0.18, 0.3, 0.24, 0.16, 0.08, 0.04].map((el) =>
      parseEther(`${el}`)
    ),
    distributionY: [0.04, 0.08, 0.16, 0.24, 0.3, 0.18, 0, 0, 0, 0, 0].map((el) =>
      parseEther(`${el}`)
    )
  }
  
  // 3) Bid-Ask
  export const bidAsk = {
    deltaIds: [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5],
    distributionX: [0, 0, 0, 0, 0, 0.04, 0.12, 0.16, 0.2, 0.24, 0.24].map((el) =>
      parseEther(`${el}`)
    ),
    distributionY: [0.24, 0.24, 0.2, 0.16, 0.12, 0.04, 0, 0, 0, 0, 0].map((el) =>
      parseEther(`${el}`)
    )
  }
  

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();
    const LB_ROUTER_ADDRESS = "";
    const LB_PAIR_ADDRESS = "";
    const PAIR_NAME = "";

    embedCommitHash("SPrime", "./contracts/token");

    let HealthMeterFacetProd = await deploy("SPrime", {
        from: deployer,
        gasLimit: 100000000,
        args: [LB_ROUTER_ADDRESS, LB_PAIR_ADDRESS, PAIR_NAME, spotUniform.distributionX, spotUniform.distributionY, spotUniform.deltaIds],
    });


    console.log(
        `SPrime deployed at address: ${HealthMeterFacetProd.address}`
    );

    await verifyContract(hre,
        {
            address: HealthMeterFacetProd.address,
            contract: `contracts/token/sPrime.sol:SPrime`,
            constructorArguments: []
        });
    console.log(`Verified SPrime`);
};

module.exports.tags = ["arbitrum-sprime"];
