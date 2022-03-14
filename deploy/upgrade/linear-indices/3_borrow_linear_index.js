/** README
 * 1. Run "npx hardhat deploy --network NETWORK_NAME --tags linear-borrow-index"
 * 2. Set a new index address in the Pool "pool.setBorrowIndex(ADDRESS_HERE)"
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

    console.log(`Deployed linear borrow index at address: ${resultIndex.address}`);

    renameSync(`./deployments/${networkName}/LinearIndex.json`, `./deployments/${networkName}/BorrowIndex.json`);

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

    console.log(`BorrowIndexTUP deployed at address: ${result.address}`);

    renameSync(`./deployments/${networkName}/LinearIndexTUP.json`, `./deployments/${networkName}/BorrowIndexTUP.json`);

    const index = await ethers.getContractFactory("LinearIndex");

    let initializeTx = await index.attach(result.address).initialize(
        poolTUP.address,
        { gasLimit: 8000000 }
    );

    await initializeTx.wait();
};

module.exports.tags = ['linear-borrow-index'];
