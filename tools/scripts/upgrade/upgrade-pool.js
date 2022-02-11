import {getChainIdForNetwork, getUrlForNetwork} from "../helpers";

const {ethers} = require("hardhat");
const fs = require('fs');
const POOL_TUP = require("../../../build/contracts/PoolTUP.json");
const key = fs.readFileSync("./.secret-admin").toString().trim();
let privateKeyWallet = new ethers.Wallet(key);

var provider;

async function upgradeProxy(networkName, address) {
    provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    let wallet = privateKeyWallet.connect(provider);

    const pool = new ethers.Contract(POOL_TUP.networks[getChainIdForNetwork(networkName)].address, POOL_TUP.abi, wallet);

    await pool.upgradeTo(address)

    return "New pool implementation address " + address;
}

module.exports.upgradePool = function upgradePool(networkName, address) {
    upgradeProxy(networkName, address).then(
        res => console.log(res),
        err => console.error(err)
    )
}
