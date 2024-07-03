const fs = require('fs');
const ethers = require("ethers");

const {getUrlForNetwork} = require("../helpers");

const LBPairAbi = require('./LBPairAbi.json');


function getProvider(){
    return new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/avalanche");
}

function initWallet(networkName) {
    const key = fs.readFileSync(`../../../.secrets/${networkName}/deployer`).toString().trim();
    console.log(getUrlForNetwork(networkName));
    const provider = getProvider();

    return new ethers.Wallet(key, provider);
}


async function checkBinsBalances(data) {
    let wallet = initWallet('avalanche');
    let provider = getProvider();

    let currentOwnerAddress = '0x8f430e5d18CCa67288c74c72bb3326F62cc1f7B7'
    let tjPoolAddress = '0x8db6684838dBdA65952ae4bC576503f6eCC03864';
    const tjPoolContract = new ethers.Contract(tjPoolAddress, LBPairAbi, wallet);

    let numberOfBinsToCheck = 100;
    let activeBinId = await tjPoolContract.getActiveId();
    console.log('activeBinId', activeBinId);

    let binIds = [];
    let binsBalances = [];
    for (let i = 1; i <= numberOfBinsToCheck; i++) {
        let leftBinBalance = await tjPoolContract.balanceOf(currentOwnerAddress, activeBinId - i);
        binIds.push(activeBinId + i);
        binsBalances.push(leftBinBalance.toString());
    }

    for (let i = 1; i <= numberOfBinsToCheck; i++) {
        let rightBinBalance = await tjPoolContract.balanceOf(currentOwnerAddress, activeBinId + i);
        binIds.push(activeBinId + i);
        binsBalances.push(rightBinBalance.toString());
    }

    for(let i = 0; i < binIds.length; i++){
        console.log(`Bin ${binIds[i]} balance: ${binsBalances[i]}`);
    }

}

const result = checkBinsBalances();
