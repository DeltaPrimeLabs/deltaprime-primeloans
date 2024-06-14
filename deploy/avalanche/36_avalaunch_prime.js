import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy } = deployments;
    const { deployer, admin } = await getNamedAccounts();

    // let AvalaunchPrime = await deploy("AvalaunchPrime", {
    //     from: deployer,
    //     args: [],
    // });
    //
    //
    // console.log(
    //     `AvalaunchPrime implementation deployed at address: ${AvalaunchPrime.address}`
    // );

    await verifyContract(hre,
        {
            address: "0x02e80675488cD8dF2CC9Fb97db89d79905E42033",
            contract: `contracts/tokens/avalaunch/AvalaunchPrime.sol:AvalaunchPrime`,
            constructorArguments: []
        });
    console.log(`Verified AvalaunchPrime`);
};

module.exports.tags = ["avalanche-avalaunch-prime"];
