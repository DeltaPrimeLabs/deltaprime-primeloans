import updateSmartLoanProperties from "../../tools/scripts/update-smart-loan-properties";
const {execSync} = require("child_process");

const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    const poolTUP = await ethers.getContract("PoolTUP");
    const exchangeTUP = await ethers.getContract("PangolinExchangeTUP");

    updateSmartLoanProperties(poolTUP.address, exchangeTUP.address);

    const output = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output);

    let result = await deploy('SLLowerLTV', {
        from: deployer,
        gasLimit: 8000000
    });

    console.log(`Deployed PoolWithAccSLLowerLTVessNFT implementation at address: ${result.address}`);


};

module.exports.tags = ['lowerLTV'];
