const fs = require("fs");
const {ethers} = require('ethers');
const EthDater = require("ethereum-block-by-date");
const fromWei = (val) => parseFloat(ethers.utils.formatEther(val));
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Promise = require('bluebird');
const TOKEN_ADDRESSES_AVALANCHE = require("../../common/addresses/avax/token_addresses.json");
const TOKEN_ADDRESSES_ARBITRUM = require("../../common/addresses/arbitrum/token_addresses.json");
const fromBytes32 = require('ethers').utils.parseBytes32String;
const knownPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const formatUnits = (val, decimalPlaces) => parseFloat(ethers.utils.formatUnits(val, decimalPlaces));
const cliProgress = require('cli-progress');

const sPrimeUniswapAbi = require('./sPrimeUniswap.json');
const sPrimeAbi = require('./sPrime.json');
const sPrimeAddress = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
const sPrimeUniswapAddress = '0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945';
const sPrimeContract = new ethers.Contract(sPrimeAddress, sPrimeAbi, getWallet('avalanche'));
const sPrimeUniswapContract = new ethers.Contract(sPrimeUniswapAddress, sPrimeUniswapAbi, getWallet('arbitrum'));
const SMARTL_LOANS_FACTORY_ABI = [
    'function getAllLoans() view returns (address[] memory)',
    'function getOwnerOfLoan(address loan) view returns (address)',
];
const CHAIN = 'arbitrum';
let factoryContract = new ethers.Contract('0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D', SMARTL_LOANS_FACTORY_ABI, getProvider(CHAIN));
let primeAccounts = []
let sPrimeHolders = []

function getRpcUrl(chain) {
    if(chain === 'arbitrum'){
        // return 'https://arb1.arbitrum.io/rpc'
        return 'https://nd-820-127-885.p2pify.com/eb20dbbf452bafebd4ea76aa69c6629e'
    } else if(chain === 'avalanche'){
        // return 'https://avalanche-mainnet.core.chainstack.com/ext/bc/C/rpc/409fa087db6ba9d631bce0d258a14484'
        return 'https://avax.nirvanalabs.xyz/avalanche_aws/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771'
        // return 'https://nd-033-589-713.p2pify.com/d41fdf9956747a40bae4edec06ad4ab9/ext/bc/C/rpc'
    }
}

function getProvider(chain) {
    return new ethers.providers.JsonRpcProvider(getRpcUrl(chain));
}

function getWallet(chain){
    return new ethers.Wallet(knownPrivateKey, getProvider(chain));
}

async function getTimestampFromBlockNumber(blockNumber, provider) {
    const block = await provider.getBlock(blockNumber);
    return block.timestamp;
}

async function getTxs(url){
    return fetch(url).then((res) => {
        // console.log(JSON.stringify(res))
        return res.json()
    });
}

// const getBlockForTimestamp = async (timestamp) => {
//     const dater = new EthDater(getProvider());
//
//     return await dater.getDate(
//       timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
//       true // Block after, optional. Search for the nearest block before or after the given date. By default true.
//     );
//   }

async function getLiquidationTxsBetweenBlocks(chain = 'avalanche', startBlock = 47425100, endBlock = 48834295) {
    // 47425100   (Jul-1-2024 17:16:36 UTC)
    // 48834295   (Aug-4-2024 12:39:38 UTC)

    const progressBar1 = new cliProgress.SingleBar({
        format: `Fetching liquidation txs between blocks ${startBlock} and ${endBlock} |{bar}| {percentage}% | Liquidator {value}/{total} Elapsed: {duration_formatted}`,
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    const liquidatorAddresses = [
        "0xD6F515Bf564F852939e2733f50a750e68e33E504",
        "0x0d25015D4567Cb6f450d58329bad6BC7eA718E67",
        "0x7e89663195f53CdaEc2F97a4CD9eC4606C5518e8",
        "0x8582FEc792dE46872fc69A5fF68A384b7f0C438D",
        "0xEBc567e074c954cE6FD370fD763E00A383E7005C",
    ];

    progressBar1.start(liquidatorAddresses.length, 0);

    const txPerPage = 100;
    let explorerRPC = chain === 'avalanche'? 'https://api.snowtrace.io' : 'https://api.arbiscan.io'
    const apiKeyArbiscan = 'XGXPCAQEJHHTZWC6YBR8JMX8HWZW61RGAQ'

    let liquidatorsTxs = [];
    for(const liquidatorAddress of liquidatorAddresses){
        let page = 1;
        while(true) {
            let url = `${explorerRPC}/api?module=account&action=txlist` +
                `&address=${liquidatorAddress}` +
                `&startblock=${startBlock}` +
                `&endblock=${endBlock}` +
                `&page=${page}` +
                `&offset=${txPerPage}` +
                `&sort=asc`

            if(chain === 'arbitrum'){
                url += `&apikey=${apiKeyArbiscan}`
            }

            let apiResult = await getTxs(url);
            let partialResult = apiResult['result'];
            if(apiResult.length === 0){
                break;
            }
            liquidatorsTxs.push(...partialResult);
            if(partialResult.length < txPerPage){
                break;
            }
            page += 1;
        }
        progressBar1.increment(1);
    }
    progressBar1.stop();

    console.log(`Found ${liquidatorsTxs.length} liquidators txs`)
    let liquidationTxs = liquidatorsTxs.filter(tx => tx['functionName'].includes('liquidateLoan'))
    console.log(`Found ${liquidationTxs.length} liquidation txs`)

    let successfullLiquidationTxs = liquidationTxs.filter(tx => tx['isError'] !== '1');
    console.log(`Found ${successfullLiquidationTxs.length} successfull liquidation txs`)


    return successfullLiquidationTxs;
}

async function getProcessedLiquidationDataFromDb(txHash){
    let apiEndpoint = `https://im34modd75.execute-api.eu-west-3.amazonaws.com/getProcessedLiquidationFromHashArbitrum?txHash=${txHash}`;
    let response = await fetch(apiEndpoint);
    let data = await response.json();
    return data['Items'][0]
}

async function processLiquidationsRevenue(chain = 'avalanche', startBlock, endBlock, epoch){
    let finalUsersLiquidationsShares = {};
    let totalUsdSum = 0;
    let totalAssetsTransferred = {};
    let usersUsdSum = {};
    let liquidationTxs = await getLiquidationTxsBetweenBlocks(chain, startBlock, endBlock);


    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar1.start(liquidationTxs.length, 0);

    for(const liquidationTx of liquidationTxs){
        bar1.increment();
        let processedLiquidationData = await getProcessedLiquidationDataFromDb(liquidationTx['hash']);
        let usersSPrimeSharesAtTimeOfLiquidation = processedLiquidationData['usersSPrimeDollarValues']; // Although it is called dollar values, it is actually the sPrime shares

        totalUsdSum += processedLiquidationData['revenueDollarValue'];
        for(const userAddress in usersSPrimeSharesAtTimeOfLiquidation){
            if(userAddress in usersUsdSum){
                usersUsdSum[userAddress] += usersSPrimeSharesAtTimeOfLiquidation[userAddress] * processedLiquidationData['revenueDollarValue'];
            } else {
                usersUsdSum[userAddress] = usersSPrimeSharesAtTimeOfLiquidation[userAddress] * processedLiquidationData['revenueDollarValue'];
            }
        }

        for(const asset in processedLiquidationData['assetsTransferred']){
            if(asset in totalAssetsTransferred){
                totalAssetsTransferred[asset] += processedLiquidationData['assetsTransferred'][asset];
            } else {
                totalAssetsTransferred[asset] = processedLiquidationData['assetsTransferred'][asset];
            }
        }
    }
    bar1.stop();

    for(const userAddress in usersUsdSum){
        if(userAddress in finalUsersLiquidationsShares){
            finalUsersLiquidationsShares[userAddress] = usersUsdSum[userAddress] / totalUsdSum;
        } else {
            finalUsersLiquidationsShares[userAddress] = usersUsdSum[userAddress] / totalUsdSum;
        }
    }

    let sumOfFinalUsersLiquidationShares = Object.values(finalUsersLiquidationsShares).reduce((a, b) => a + b, 0);
    if(Math.abs(sumOfFinalUsersLiquidationShares - 1) > 0.0001){
        console.error(`Sum of final users liquidation shares is not 1: ${sumOfFinalUsersLiquidationShares}`);
    } else {
        console.log(`Sum of final users liquidation shares is 1: ${sumOfFinalUsersLiquidationShares}`);
    }

    console.log(`Users USD sum: ${Object.values(usersUsdSum).reduce((a, b) => a + b, 0)}`);
    console.log(`Total USD sum: ${totalUsdSum}`);

    // save finalUsersLiquidationsShares to json file
    writeJSON(`revSharing${chain}Epoch${epoch}.json`, finalUsersLiquidationsShares);

}

function writeJSON(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf8');
}

async function checkSPrimeTotalValueMinted(chain){
    let sPrime = chain === 'avalanche'? sPrimeContract : sPrimeUniswapContract;
    let tokenYName = chain === 'avalanche'? 'AVAX' : 'ETH';
    let tokenYPrice = (await getRedstonePrices([tokenYName], chain))[tokenYName];
    console.log('Token Y price: ', tokenYPrice);
    console.log('Getting holders')
    const currentTimestampInSeconds = Math.floor(Date.now() / 1000);
    let sPrimeHolders = await getSPrimeHoldersAtTimestampFromSubgraph(chain, currentTimestampInSeconds);
    console.log('Getting holders balances')
    let balances = await getUsersValuesInTokenYCurrent(sPrimeHolders, chain);
    let totalValue = Object.values(balances).reduce((a, b) => a + b, 0);
    console.log(`Total value in Token Y: ${totalValue} for chain ${chain}`);
}

async function getUserValueInTokenYCurrent(userAddress, chain){
    let contract = chain === 'avalanche'? sPrimeContract : sPrimeUniswapContract;

    return contract['getUserValueInTokenY(address)'](userAddress);

}

async function getUsersValuesInTokenYCurrent(holders, chain){
    let usersValuesInTokenY = {}
    let usersValues;
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return getUserValueInTokenYCurrent(address, chain).then(userValueInTokenY => {
            return userValueInTokenY;
        });
    }, { concurrency: 50 }).then(results => {
        // console.log('All user values fetched');
        usersValues = results.map(balance => Number(fromWei(balance.toString())))
    }).catch(error => {
        console.error('Error fetching in range', error);
    });

    for(let i=0; i<holders.length; i++){
        usersValuesInTokenY[holders[i]] = usersValues[i];
    }

    return usersValuesInTokenY;
}

async function getSPrimeHoldersAtTimestampFromSubgraph(chain, timestamp) {
    let url;
    if (chain === 'avalanche') {
        url = 'https://api.studio.thegraph.com/query/78666/deltaprime/version/latest';
    } else if (chain === 'arbitrum') {
        url = 'https://api.studio.thegraph.com/query/50916/deltaprime/version/latest';
    }

    let holders = [];
    let skip = 0;
    const pageSize = 100;

    while (true) {
        let query = `
        {
            sprimeHolders(where: {createdAt_lte: "${timestamp}"}, first: ${pageSize}, skip: ${skip}) {
                id
                createdAt
            }
        }
        `;

        let response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query }),
        });

        let responseJson = await response.json();
        let currentBatch = responseJson['data']['sprimeHolders'];

        if (currentBatch.length === 0) {
            break;
        }

        holders.push(...currentBatch);
        skip += pageSize;
    }

    console.log(`Holders: ${holders.length}`);
    return holders.map(holder => holder['id']);
}

async function getRedstonePrices(tokenSymbols, chain) {
    const dataServiceId = process.env.dataServiceId ?? `redstone-${chain}-prod`;
    const url = `https://oracle-gateway-1.a.redstone.finance/data-packages/latest/${dataServiceId}`

    const redstonePrices = await (await fetch(url)).json();

    let result = {};
    for (const symbol of tokenSymbols) {
        try {
            result[symbol] = getPricesWithLatestTimestamp(redstonePrices, symbol);
        } catch {}
    }
    return result;
}

function getPricesWithLatestTimestamp(prices, symbol) {
    if (symbol in prices) {
        let symbolPriceObject = prices[symbol];
        let currentNewestTimestampIndex = 0;
        for (let i = 0; i < symbolPriceObject.length; i++) {
            if (symbolPriceObject[i].timestampMilliseconds > symbolPriceObject[currentNewestTimestampIndex].timestampMilliseconds) {
                currentNewestTimestampIndex = i;
            }
        }
        return symbolPriceObject[currentNewestTimestampIndex].dataPoints[0].value;
    } else {
        throw new Error(`Symbol ${symbol} not found in the prices object`);
    }
}



// checkFailedLiquidationTxsEvents(1720952696, 1721471096);
// processSuccessfullLiquidationTx({hash: '0x365372c222960a9d56498f7537729caa6a9df39a7ef516c2d224bb70ced1e592'})
// processLiquidationsRevenue('avalanche', 48829999, 48872209);
processLiquidationsRevenue('arbitrum', 227699100, 240352048, 0);
// checkSPrimeTotalValueMinted('arbitrum');