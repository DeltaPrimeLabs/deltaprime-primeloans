/** README
 * 1. Run "npx hardhat deploy --network NETWORK_NAME --tags linear-deposit-index"
 * 2. Set a new index address in the Pool "pool.setDepositIndex(ADDRESS_HERE)"
 */

import verifyContract from "../../../tools/scripts/verify-contract";
import {ethers} from "hardhat";
import {embedCommitHash} from "../../../tools/scripts/embed-commit-hash";
import {renameSync} from "fs";
const hre = require("hardhat");
const networkName = hre.network.name

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('LinearIndex');

    const poolTUP = await ethers.getContract("PoolTUP");

    let resultIndex = await deploy('LinearIndex', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    await verifyContract(hre, {
        address: resultIndex.address,
        constructorArguments: []
    })

    console.log(`Deployed linear deposit index at address: ${resultIndex.address}`);

    renameSync(`./deployments/${networkName}/LinearIndex.json`, `./deployments/${networkName}/DepositIndex.json`);

    let result = await deploy('LinearIndexTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [resultIndex.address, admin, []],
    });

    await verifyContract(hre, {
        address: result.address,
        contract: "contracts/proxies/LinearIndexTUP.sol:LinearIndexTUP",
        constructorArguments: [
            resultIndex.address,
            admin,
            []
        ]
    });

    console.log(`DepositIndexTUP deployed at address: ${result.address}`);

    renameSync(`./deployments/${networkName}/LinearIndexTUP.json`, `./deployments/${networkName}/DepositIndexTUP.json`);

    const index = await ethers.getContractFactory("LinearIndex");

    let initializeTx = await index.attach(result.address).initialize(
        poolTUP.address,
        { gasLimit: 8000000 }
    );

    await initializeTx.wait();
};

module.exports.tags = ['linear-deposit-index'];
