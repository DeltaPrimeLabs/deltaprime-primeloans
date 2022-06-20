import {embedCommitHash} from "../tools/scripts/embed-commit-hash";

const {execSync} = require("child_process");
const {ethers} = require("hardhat");
import updateSmartLoanLibrary from "../tools/scripts/update-smart-loan-library"
import {deployDiamond, deployFacet} from "../test/integration/smart-loan/utils/deploy-diamond";

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('SmartLoanDiamond');
    embedCommitHash('SmartLoanLib', 'contracts/lib');
    embedCommitHash('LTVLib', 'contracts/lib');
    embedCommitHash('LibDiamond', 'contracts/lib');

    const diamondAddress = await deployDiamond({
        deployer: deployer,
        deploy: deploy
    });

    const wavaxPoolTUP = await ethers.getContract("WavaxPoolTUP");
    const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP");
    const exchangeTUP = await ethers.getContract("PangolinExchangeTUP");
    const yieldYakRouter = await ethers.getContract("YieldYakRouter");

    updateSmartLoanLibrary(
        [0, 1],
        ["0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", "0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664"],
        {'AVAX': wavaxPoolTUP.address, 'USDC': usdcPoolTUP.address},
        exchangeTUP.address,
        yieldYakRouter.address,
        5000,
        4000
    );

    const output = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output);

    // Deploy LTVLib and later link contracts to it
    const ltvLib = await deploy('LTVLib', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    await deployFacet("SmartLoanLogicFacet", diamondAddress, [], ltvLib.address, {
        deployer: deployer,
        deploy: deploy
    });

    await deployFacet("SmartLoanLiquidationFacet", diamondAddress, ["liquidateLoan"], ltvLib.address, {
        deployer: deployer,
        deploy: deploy
    });


    //TODO: verify contracts
    console.log(`Deployed SmartLoanDiamond at address: ${diamondAddress}`);

};

module.exports.tags = ['init'];
