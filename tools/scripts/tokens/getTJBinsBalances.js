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

    let fromBin = 8387987;
    let toBin = 8388305;

    console.log(`Checking bins balances from ${fromBin} to ${toBin} for address ${currentOwnerAddress} on LBPair contract ${tjPoolAddress}`)

    let activeBinId = await tjPoolContract.getActiveId();
    console.log('activeBinId', activeBinId);
    if(fromBin >= activeBinId){
        throw new Error('fromBin is greater than activeBinId');
    }

    let binIds = [];
    let binsBalances = [];
    let totalBalance = 0;

    while(fromBin <= toBin){
        let binBalance = await tjPoolContract.balanceOf(currentOwnerAddress, fromBin);
        binIds.push(fromBin);
        binsBalances.push(binBalance.toString());
        totalBalance += parseFloat(ethers.utils.formatUnits(binBalance, 'ether'));
        fromBin++;
    }

    // for (let i = 0; i < numberOfBinsToCheck; i++) {
    //     let leftBinBalance = await tjPoolContract.balanceOf(currentOwnerAddress, activeBinId - (numberOfBinsToCheck - i));
    //     binIds.push(activeBinId - (numberOfBinsToCheck - i));
    //     binsBalances.push(leftBinBalance.toString());
    // }
    //
    // for (let i = 0; i < numberOfBinsToCheck; i++) {
    //     let rightBinBalance = await tjPoolContract.balanceOf(currentOwnerAddress, activeBinId + i + 1);
    //     binIds.push(activeBinId + i + 1);
    //     binsBalances.push(rightBinBalance.toString());
    // }

    for(let i = 0; i < binIds.length; i++){
        console.log(`Bin ${binIds[i]} balance: ${binsBalances[i]}`);
    }
    console.log(`Total balance: ${totalBalance}`);
    console.log(JSON.stringify(binIds));
    console.log(JSON.stringify(binsBalances));

}

const result = checkBinsBalances();
