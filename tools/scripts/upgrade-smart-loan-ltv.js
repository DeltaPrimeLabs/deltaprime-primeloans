const config = require('../network/config-local.json');
const {ethers} = require("hardhat");
const UPGRADEABLE_BEACON = require("../../build/contracts/UpgradeableBeacon.json")
const FACTORY = require('../../build/contracts/SmartLoansFactory.json');
const SL = require('../../build/contracts/SmartLoan.json');
const FACTORY_TUP = require('../../build/contracts/SmartLoansFactoryTUP.json');
const POOL_TUP = require('../../build/contracts/SmartLoansFactoryTUP.json');
const PANGOLIN_EXCHANGE_TUP = require('../../build/contracts/PangolinExchangeTUP.json');
const args = require('yargs').argv;

let maxltv = args.maxltv ? args.interval : 5000;
let minltv = args.minltv ? args.minltv : 4000;

const fs = require('fs');
const execSync = require('child_process').execSync;
const key = fs.readFileSync("./.secret-deployer").toString().trim();
let privateKeyWallet = new ethers.Wallet(key);

var provider;

// provider = new ethers.providers.JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc"); // Leave blank for localhost
provider = new ethers.providers.JsonRpcProvider(); // Leave blank for localhost

let wallet = privateKeyWallet.connect(provider);
const factory = new ethers.Contract(FACTORY_TUP.networks[config["network-id"]].address, FACTORY.abi, wallet);

async function upgradeBeacon(maxltv, minltv) {
    // Update Smart Loan properties
    let output1 = execSync(`node -r esm -e "require('./tools/scripts/update-smart-loan-properties.js')` +
        `.updateContracts('${POOL_TUP.networks[config["network-id"]].address.toString()}','${PANGOLIN_EXCHANGE_TUP.networks[config["network-id"]].address.toString()}','${maxltv}', '${minltv}')"`, { encoding: 'utf-8' });
    // console.log(output1);

    // Recompile contracts
    const output2 = execSync('truffle compile --all', { encoding: 'utf-8' });
    // console.log(output2);

    const Contract = await ethers.getContractFactory("SmartLoan");
    const contract = await Contract.deploy();
    await contract.deployed();

    const beaconAddress = await factory.upgradeableBeacon.call(0);
    const beacon = (await new ethers.Contract(beaconAddress, UPGRADEABLE_BEACON.abi)).connect(wallet);
    await beacon.upgradeTo(contract.address, { gasLimit: 8000000});

    return "New implementation address " + contract.address;
}

upgradeBeacon(maxltv, minltv).then(
    res => console.log(res),
    err => console.error(err)
)


