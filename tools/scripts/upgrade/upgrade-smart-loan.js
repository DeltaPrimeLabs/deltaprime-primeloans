import {getChainIdForNetwork, getUrlForNetwork} from "../helpers";

const {ethers} = require("hardhat");
const UPGRADEABLE_BEACON = require("../../../build/contracts/UpgradeableBeacon.json")

const fs = require('fs');
const FACTORY_TUP = require("../../../build/contracts/SmartLoansFactoryTUP.json");
const FACTORY = require("../../../build/contracts/SmartLoansFactory.json");
const key = fs.readFileSync("./.secret-deployer").toString().trim();
let privateKeyWallet = new ethers.Wallet(key);

var provider;

async function upgradeBeacon(networkName, address) {
    provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    let wallet = privateKeyWallet.connect(provider);

    const factory = new ethers.Contract(FACTORY_TUP.networks[getChainIdForNetwork(networkName)].address, FACTORY.abi, wallet);

    const beaconAddress = await factory.upgradeableBeacon.call(0);
    const beacon = (await new ethers.Contract(beaconAddress, UPGRADEABLE_BEACON.abi)).connect(wallet);
    await beacon.upgradeTo(address, { gasLimit: 8000000});

    return "New implementation address " + address;
}

module.exports.upgradeSmartLoan = function upgradeSmartLoan(networkName, address) {
    upgradeBeacon(networkName, address).then(
        res => console.log(res),
        err => console.error(err)
    )
}

