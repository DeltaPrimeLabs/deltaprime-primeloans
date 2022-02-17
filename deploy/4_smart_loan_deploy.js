const {execSync} = require("child_process");
const {ethers} = require("hardhat");
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    let output1;
    //checking if Windows

    const poolTUP = await ethers.getContract("PoolTUP");
    const exchangeTUP = await ethers.getContract("PangolinExchangeTUP");

    if (process.platform === "win32") {
        output1 = execSync(`node -r esm -e "require('./tools/scripts/update-smart-loan-properties.js')` +
            `.updateContracts('${poolTUP.address.toString()}','${exchangeTUP.address.toString()}')"`, { encoding: 'utf-8' });
    } else {
        output1 = execSync(`node -r esm -e 'require("./tools/scripts/update-smart-loan-properties.js")` +
            `.updateContracts("${poolTUP.address.toString()}","${exchangeTUP.address.toString()}")'`, { encoding: 'utf-8' });
    }

    console.log(output1);
    const output2 = execSync('npx hardhat compile', { encoding: 'utf-8' });
    console.log(output2);

    let result = await deploy('SmartLoan', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    console.log(`Deployed SmartLoan default implementation at address: ${result.address}`);

};