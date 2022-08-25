import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const {execSync} = require("child_process");
const {ethers} = require("hardhat");
import updateSmartLoanLibrary from "../../tools/scripts/update-smart-loan-library"
import {deployDiamond, deployFacet} from "../../tools/diamond/deploy-diamond";

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('SmartLoanDiamondBeacon');
    embedCommitHash('SmartLoanConfigLib', 'contracts/lib');
    embedCommitHash('DiamondStorageLib', 'contracts/lib');

    const diamondAddress = await deployDiamond({
        deployer: deployer,
        deploy: deploy
    });

    const pangolinIntermediary = await ethers.getContract("PangolinIntermediaryTUP");
    const tokenManager = await ethers.getContract("TokenManager");
    const redstoneConfigManager = await ethers.getContract("RedstoneConfigManager");

    updateSmartLoanLibrary(
        [
            {
                facetPath: './contracts/faucets/PangolinDEXFacet.sol',
                contractAddress: pangolinIntermediary.address,
            }
        ],
        tokenManager.address,
        redstoneConfigManager.address,
        diamondAddress,
        ethers.constants.AddressZero,
        'lib'
    );

    const output = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output);

    await deployFacet("SmartLoanLogicFacet", diamondAddress, [], {
        deployer: deployer,
        deploy: deploy
    });

    await deployFacet("SmartLoanLiquidationFacet", diamondAddress, ["liquidateLoan"], {
        deployer: deployer,
        deploy: deploy
    });


    //TODO: verify contracts
    console.log(`Deployed SmartLoanDiamondBeacon at address: ${diamondAddress}`);

};

module.exports.tags = ['avalanche'];
