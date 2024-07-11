const ethers = require('ethers');
const LBPairAbi = require('./LBPairAbi.json');

const startBinNumber = 8387987;
const endBinNumber = 8388305;

const provider = new ethers.providers.JsonRpcProvider('https://rpc.ankr.com/avalanche');

async function run(){
    const COL_AVALANCHE_MULTISIG = '0x3813f577Aedc5F26F36B8638EDbB949d169F7fDc';
    let sPrimeContract = new ethers.Contract('0x8db6684838dBdA65952ae4bC576503f6eCC03864', LBPairAbi, provider);
    let currentBin = startBinNumber;
    let binNumbers = [];
    let binBalances = [];
    while(currentBin <= endBinNumber){
        console.log('Checking bin:', currentBin)
        let binBalance = await sPrimeContract.balanceOf(COL_AVALANCHE_MULTISIG, currentBin);
        binNumbers.push(currentBin);
        binBalances.push(binBalance.toString());
        currentBin++;
    }
    console.log(JSON.stringify(binNumbers))
    console.log(JSON.stringify(binBalances));
}

run();