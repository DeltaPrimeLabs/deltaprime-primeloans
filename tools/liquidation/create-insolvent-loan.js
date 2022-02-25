const ethers = require('ethers');
const {WrapperBuilder} = require("redstone-evm-connector");
const {execSync} = require("child_process");
const {upgradeSmartLoan} = require("../scripts/upgrade/upgrade-smart-loan");

const toWei = ethers.utils.parseUnits;
const toBytes32 = ethers.utils.formatBytes32String;

const FACTORY_ABI = require("../../deployments/localhost/SmartLoansFactory.json").abi;
const POOL_ABI = require("../../artifacts/contracts/Pool.sol/Pool.json").abi;
const FACTORY_ADDRESS = require("../../deployments/localhost/SmartLoansFactoryTUP.json").address;
const POOL_ADDRESS = require("../../deployments/localhost/PoolTUP.json").address;
const LOAN_ABI = require("../../deployments/localhost/SmartLoan.json").abi;

const PRIVATE_KEY = '0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61';
const RPC_URL = ''
let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let wallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);

async function createInsolventLoan() {
    let factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);
    factory = WrapperBuilder
        .wrapLite(factory)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche
    await factory.createAndFundLoan(toWei("16"), {value: toWei("3.6"), gasLimit: 8000000});
    console.log("Loan created")
}

async function buyEthers() {
    let factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);
    let loanAddress = await factory.getLoanForOwner(wallet.address);
    let loan = new ethers.Contract(loanAddress, LOAN_ABI, wallet);
    loan = WrapperBuilder
        .wrapLite(loan)
        .usingPriceFeed("redstone-avalanche-prod"); // redstone-avalanche
    await loan.invest(toBytes32("ETH"), toWei("0.3"), toWei("18"), {gasLimit: 8000000});
    console.log('Purchased ether')
}


async function fundPool() {
    let pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, wallet);
    await pool.deposit({value: toWei("1000"), gasLimit: 8000000,});
    console.log("Funded")
}

async function main() {
    await fundPool();
    await createInsolventLoan();
    await buyEthers();
    // Deploy Lower LTV Smart Loan contract
    execSync("npx hardhat deploy --network localhost --tags lowerLTV");
    // Upgrade Smart Loan implementation contract
    await upgradeSmartLoan("localhost", "SLLowerLTV");
}

module.exports = {
    main
}

