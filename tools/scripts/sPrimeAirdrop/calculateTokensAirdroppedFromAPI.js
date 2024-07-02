const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const { BigNumber, ethers } = require('ethers');

// const API_URL = 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api';
const API_URL = 'https://api.snowtrace.io/api';
const CONTRACT_ADDRESS = '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7';
const ACCOUNT_ADDRESS = '0x77134cbC06cB00b66F4c7e623D5fdBF6777635EC';
const START_BLOCK = 47434197;
const END_BLOCK = 47457786; // Replace with a suitable end block if needed
const PRIME_TOKEN_ADDRESS = '0x33C8036E99082B0C395374832FECF70c42C7F298';
const TARGET_ACCOUNT = '0xbAc44698844f13cF0AF423b19040659b688ef036';

async function fetchTransactions(page) {
    try {
        const url = `${API_URL}?module=account&action=tokentx&contractaddress=${PRIME_TOKEN_ADDRESS}&address=${ACCOUNT_ADDRESS}&page=${page}&offset=100&startblock=${START_BLOCK}&endblock=${END_BLOCK}&sort=asc`;
        console.log('Fetching transactions from:', url);
        const response = await fetch(url);
        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return [];
    }
}

async function calculatePrimeTransfers() {
    let page = 1;
    let hasMoreTransactions = true;
    let primeSum = BigNumber.from(0);

    while (hasMoreTransactions) {
        const transactions = await fetchTransactions(page);

        console.log(`Got ${transactions.length} transactions on page ${page}`)

        if (transactions.length === 0) {
            hasMoreTransactions = false;
        } else {
            transactions.forEach(tx => {
                if (
                    tx.from.toLowerCase() == TARGET_ACCOUNT.toLowerCase()
                ) {
                    primeSum = primeSum.add(BigNumber.from(tx.value));
                }
            });
            page++;
        }
    }

    console.log('Total PRIME tokens transferred out:', ethers.utils.formatUnits(primeSum, 18));
}

calculatePrimeTransfers();
