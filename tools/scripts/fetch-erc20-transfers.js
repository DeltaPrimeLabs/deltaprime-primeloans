// Import the necessary modules
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration variables
const API_URL = 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api';
const ADDRESS = '0x8Ac151296Ae72a8AeE01ECB33cd8Ad9842F2704f'; // Your multisig safe address
const START_BLOCK = '40135054';
const PAGE_SIZE = 100;

// Array of token contract addresses to fetch transfers for
const tokenAddresses = {
    "AVAX": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "USDC": "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
    "EUROC": "0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD",
    "sAVAX": "0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE",
    "ggAVAX": "0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3",
    "yyAVAX": "0xF7D9281e8e363584973F946201b82ba72C965D27",
    "ETH": "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab",
    "BTC": "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
    "USDT": "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
    "QI": "0x8729438eb15e2c8b576fcc6aecda6a148776c0f5",
    "PNG": "0x60781C2586D68229fde47564546784ab3fACA982",
    "JOE": "0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd",
    "CAI": "0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0"
};

// Function to fetch all pages of transfers for a given token
async function fetchAllTransfers(tokenAddress) {
    let page = 1;
    let allTransfers = [];
    let hasMore = true;

    while (hasMore) {
        const url = `${API_URL}?module=account&action=tokentx&contractaddress=${tokenAddress}&address=${ADDRESS}&page=${page}&offset=${PAGE_SIZE}&startblock=${START_BLOCK}&sort=asc`;

        try {
            // sleep for 1 second to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(url)
            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== '1' || !data.result || data.result.length === 0) {
                hasMore = false;
            } else {
                allTransfers = allTransfers.concat(data.result);
                page++;
            }
        } catch (error) {
            console.error(`Error fetching data for token ${tokenAddress} on page ${page}:`, error);
            hasMore = false;
        }
    }

    return allTransfers;
}

// Function to process transfers and extract required fields
function processTransfers(transfers) {
    return transfers.map(transfer => {
        const decimals = parseInt(transfer.tokenDecimal, 10);
        const normalizedValue = parseFloat(transfer.value) / Math.pow(10, decimals);

        return {
            value: normalizedValue,
            contractAddress: transfer.contractAddress,
            timeStamp: transfer.timeStamp,
            txHash: transfer.hash,
        };
    });
}

// Main function to orchestrate fetching and processing
async function main() {
    let allProcessedTransfers = [];

    for (const tokenAddress of Object.values(tokenAddresses)) {
        console.log(`Fetching transfers for token: ${tokenAddress}`);
        const transfers = await fetchAllTransfers(tokenAddress);
        const processedTransfers = processTransfers(transfers);
        allProcessedTransfers = allProcessedTransfers.concat(processedTransfers);
    }

    // Save the processed transfers to a local JSON file
    fs.writeFileSync(`transfers-to-${ADDRESS}.json`, JSON.stringify(allProcessedTransfers, null, 2));
    console.log('Transfers have been saved to transfers.json');
}

// Run the main function
main().catch(error => {
    console.error('An error occurred:', error);
});