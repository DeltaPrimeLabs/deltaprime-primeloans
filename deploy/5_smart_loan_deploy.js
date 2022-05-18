import {embedCommitHash} from "../tools/scripts/embed-commit-hash";

const {execSync} = require("child_process");
const {ethers} = require("hardhat");
import updateSmartLoanProperties from "../tools/scripts/update-smart-loan-properties"
import hre from "hardhat";
import verifyContract from "../tools/scripts/verify-contract";

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('SmartLoan');

    const poolTUP = await ethers.getContract("PoolTUP");
    const exchangeTUP = await ethers.getContract("PangolinExchangeTUP");
    const yieldYakRouter = await ethers.getContract("YieldYakRouter");

    updateSmartLoanProperties(poolTUP.address, exchangeTUP.address, yieldYakRouter.address);

    const output = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output);

    let result = await deploy('SmartLoan', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    await verifyContract(hre, {
        address: result.address
    })

    console.log(`Deployed SmartLoan default implementation at address: ${result.address}`);

};

module.exports.tags = ['init'];
