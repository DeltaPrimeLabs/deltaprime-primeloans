const fetch = require('node-fetch');
const sPrimeAbi = require('./abis/sPrimeAbi.json')
const { ethers } = require('ethers');
const fs = require("fs");

const sPrimeInterface = new ethers.utils.Interface(sPrimeAbi);

// Replace with your Arbiscan API key
const API_KEY = 'XGXPCAQEJHHTZWC6YBR8JMX8HWZW61RGAQ';

// Function to fetch transactions for a specified address
const getTransactions = async (address, fromBlock, toBlock) => {
    let page = 1;
    const offset = 1000; // Maximum offset per API call
    let transactions = [];
    let hasMore = true;
    let apiCallsCounter = 1;

    while (hasMore) {
        const apiUrl = `https://api.arbiscan.io/api?module=account&action=txlist&address=${address}&startblock=${fromBlock}&endblock=${toBlock}&page=${page}&offset=${offset}&sort=asc&apikey=${API_KEY}`;
        console.log('Fetching transactions:', apiUrl)

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status !== '1') {
                throw new Error(data.message);
            }

            transactions = transactions.concat(data.result);

            if (data.result.length < offset) {
                hasMore = false;
            } else {
                page += 1;
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            hasMore = false;
        }

        // every 5 calls sleep for 1 second
        if (apiCallsCounter % 5 === 0) {
            console.log('Sleeping for 1 second');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        apiCallsCounter++;
    }

    return transactions;
};

function getMintDetailsFromCalldata(calldata){
    const decodedDetails = sPrimeInterface.decodeFunctionData('mintForUserAndLock', calldata);
    let userAddress = decodedDetails.user;
    let primeAmount = ethers.utils.formatEther(decodedDetails.amountX.toString());
    let wethAmount = ethers.utils.formatEther(decodedDetails.amountY.toString());
    return {userAddress, primeAmount, wethAmount};
}

// method for filtering transactions based on "to" address
async function filterByToAddress(transactions, toAddress){
    return transactions.filter(tx => tx.to.toLowerCase() === toAddress.toLowerCase());
}

// method for filtering transactions based on the method selector
async function filterByMethodSelector(transactions, methodSelector){
    return transactions.filter(tx => tx.input.startsWith(methodSelector));
}

function getDollarValueFromMintAmounts(primeAmount, wethAmount){
    const PRIME_PRICE = 1.3125;
    const WETH_PRICE = 3150;
    return primeAmount * PRIME_PRICE + wethAmount * WETH_PRICE;
}

function writeJSON(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf8');
}

async function analyzeMintedSPrimeDollarValuePerUser(){
    let transactions = await getTransactions(MINTER_ADDRESS, FROM_BLOCK, TO_BLOCK)
    let totalPrimeDistributed = 0, totalWethDistributed = 0;
    let userMintedSPrimeDollarValue = {};

    console.log('Transactions:', transactions.length)
    transactions = await filterByToAddress(transactions, S_PRIME_CONTRACT_ADDRESS);
    console.log('Transactions after filtering by to address:', transactions.length)
    transactions = await filterByMethodSelector(transactions, MINT_FOR_USER_AND_LOCK_SELECTOR);
    console.log('Transactions after filtering by method selector:', transactions.length)

    for(const tx of transactions){
        let txDetails = getMintDetailsFromCalldata(tx.input);
        totalPrimeDistributed += parseFloat(txDetails.primeAmount);
        totalWethDistributed += parseFloat(txDetails.wethAmount);

        let mintDollarValue = getDollarValueFromMintAmounts(txDetails.primeAmount, txDetails.wethAmount);
        if(!userMintedSPrimeDollarValue[txDetails.userAddress]){
            userMintedSPrimeDollarValue[txDetails.userAddress] = mintDollarValue;
        } else {
            userMintedSPrimeDollarValue[txDetails.userAddress] += mintDollarValue;
        }
    }

    console.log(`Total Prime distributed: ${totalPrimeDistributed}`);
    console.log(`Total WETH distributed: ${totalWethDistributed}`);

    let totalMintedDollarValue = Object.values(userMintedSPrimeDollarValue).reduce((a, b) => a + b, 0);
    console.log('Total minted dollar value:', totalMintedDollarValue);

    let primeLeftToDistribute = LM_AIRDROP_PRIME_AMOUNT + LOYALTY_AIRDROP_PRIME_AMOUNT - totalPrimeDistributed;
    let wethLeftToDistribute = LM_AIRDROP_WETH_AMOUNT + LOYALTY_AIRDROP_WETH_AMOUNT - totalWethDistributed;
    console.log(`Prime left to distribute: ${primeLeftToDistribute}`);
    console.log(`WETH left to distribute: ${wethLeftToDistribute}`);

    writeJSON(SPRIME_MINTED_FILENAME, userMintedSPrimeDollarValue);
}

// function to read SPRIME_MINTED_FILENAME JSON file and output sum of all values
function sumMintedSPrimeDollarValuePerUser(){
    let userMintedSPrimeDollarValue = readJSON(SPRIME_MINTED_FILENAME);
    let totalMintedDollarValue = Object.values(userMintedSPrimeDollarValue).reduce((a, b) => a + b, 0);
    console.log('Total minted dollar value:', totalMintedDollarValue);

}
function readJSON(filename) {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
}

const S_PRIME_CONTRACT_ADDRESS = '0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945';
const MINTER_ADDRESS = '0xbAc44698844f13cF0AF423b19040659b688ef036';
const MINT_FOR_USER_AND_LOCK_SELECTOR = '0x1d648fd1';
const FROM_BLOCK = 227701590 // Timestamp: 1719853200 - 01/07/2024 @ 19:00 (CET)
const TO_BLOCK = 231028617 // Timestamp: 1720687560 - 11/07/2024 @ 10:46 (CET)

const LM_AIRDROP_PRIME_AMOUNT = 42473.97368;
const LM_AIRDROP_WETH_AMOUNT = 16.14010987178152631;
const LOYALTY_AIRDROP_PRIME_AMOUNT = 39425.09784;
const LOYALTY_AIRDROP_WETH_AMOUNT = 14.94669004;
const TOTAL_DOLLAR_VALUE_TO_BE_DISTRIBUTED = getDollarValueFromMintAmounts(LM_AIRDROP_PRIME_AMOUNT + LOYALTY_AIRDROP_PRIME_AMOUNT, LM_AIRDROP_WETH_AMOUNT + LOYALTY_AIRDROP_WETH_AMOUNT);

const SPRIME_MINTED_FILENAME = 'sPrimeMintedDollarValuePerUser.json';

console.log(`Total Prime to be distributed: ${LM_AIRDROP_PRIME_AMOUNT + LOYALTY_AIRDROP_PRIME_AMOUNT}`);
console.log(`Total WETH to be distributed: ${LM_AIRDROP_WETH_AMOUNT + LOYALTY_AIRDROP_WETH_AMOUNT}`);
console.log(`Total dollar value to be distributed: $${TOTAL_DOLLAR_VALUE_TO_BE_DISTRIBUTED}`)


analyzeMintedSPrimeDollarValuePerUser();
// sumMintedSPrimeDollarValuePerUser(); // verify the sum of all minted dollar values saved to JSON