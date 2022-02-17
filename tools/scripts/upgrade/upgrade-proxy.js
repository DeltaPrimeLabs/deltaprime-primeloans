import {getChainIdForNetwork, getUrlForNetwork} from "../helpers";

const {ethers} = require("hardhat");

const fs = require('fs');
const key = fs.readFileSync("./.secret-admin").toString().trim();
let privateKeyWallet = new ethers.Wallet(key);

var provider;

module.exports.upgradeProxy = async function upgradeProxy(networkName, address, proxy, contractName) {
    provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    let wallet = privateKeyWallet.connect(provider);

    const factory = new ethers.Contract(proxy.networks[getChainIdForNetwork(networkName)].address, proxy.abi, wallet);

    await factory.upgradeTo(address)

    return `New ${contractName} implementation address: ${address}`;
}

