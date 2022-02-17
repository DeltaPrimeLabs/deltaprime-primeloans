import {getChainIdForNetwork, getUrlForNetwork} from "../helpers";

const {ethers} = require("hardhat");

const fs = require('fs');
const FACTORY_TUP = require("../../../build/contracts/SmartLoansFactoryTUP.json");
const key = fs.readFileSync("./.secret-admin").toString().trim();
let privateKeyWallet = new ethers.Wallet(key);

var provider;

async function upgradeProxy(networkName, address) {
    provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    let wallet = privateKeyWallet.connect(provider);

    const factory = new ethers.Contract(FACTORY_TUP.networks[getChainIdForNetwork(networkName)].address, FACTORY_TUP.abi, wallet);

    await factory.upgradeTo(address)

    return "New SmartLoansFactory implementation address " + address;
}

module.exports.upgradeSmartLoansFactory = function upgradeSmartLoansFactory(networkName, address) {
    upgradeProxy(networkName, address).then(
        res => console.log(res),
        err => console.error(err)
    )
}

