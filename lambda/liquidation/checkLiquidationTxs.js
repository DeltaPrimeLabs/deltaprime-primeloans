const {ethers} = require('ethers');
const EthDater = require("ethereum-block-by-date");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const TOKEN_ADDRESSES = require("../../common/addresses/avax/token_addresses.json");
const fromBytes32 = require('ethers').utils.parseBytes32String;
const formatUnits = (val, decimalPlaces) => parseFloat(ethers.utils.formatUnits(val, decimalPlaces));

const sPrimeUniswapAbi = require('./sPrimeUniswap.json');
const sPrimeUniswapAddress = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
const sPrimeUniswapContract = new ethers.Contract(sPrimeUniswapAddress, sPrimeUniswapAbi, getProvider());

function getRpcUrl() {
    return 'https://avax.nirvanalabs.xyz/avalanche_aws/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771'
}

function getProvider() {
    return new ethers.providers.JsonRpcProvider(getRpcUrl());
}

async function getTxs(url){
    return fetch(url).then((res) => {
        // console.log(JSON.stringify(res))
        return res.json()
    });
}

const getBlockForTimestamp = async (timestamp) => {
    const dater = new EthDater(getProvider());
  
    return await dater.getDate(
      timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
      true // Block after, optional. Search for the nearest block before or after the given date. By default true.
    );
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

async function getRedstonePrices(tokenSymbols) {
    const dataServiceId = process.env.dataServiceId ?? "redstone-avalanche-prod";
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

async function getDollarValue(decimals, balance, price) {
    return  formatUnits(balance, decimals) * price;

}

async function processSuccessfullLiquidationTx(tx) {
    const abi = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "event Transfer(address indexed from, address indexed to, uint amount)"
    ];
    let provider = getProvider();

    const hash = tx['hash']

    const txRes = await provider.getTransaction(hash);
    const receipt = await txRes.wait();
    const feeTransferLogs = receipt.logs.filter(log => log.topics[0] === '0xd5e79e0953563b535ee3d864e1ac35be98c6a24c9c38b6b91c358cea8c68939b');

    const tokenSymbols = Object.keys(TOKEN_ADDRESSES);
    const prices = await getRedstonePrices(tokenSymbols);
    let totalUsdValue = 0;
    let usdValue = 0;
    for (const log of feeTransferLogs) {
        const asset = fromBytes32(log.topics[2]);
        const [amount] = new ethers.utils.AbiCoder().decode(['uint256', 'uint256'], log.data);
        let erc20 = new ethers.Contract(TOKEN_ADDRESSES[asset], abi, provider);
        let decimals = await erc20.decimals();

        if (amount.gt(0)) {
            let balanceString = amount.toString();
            usdValue = 0;
            try{
                usdValue = await getDollarValue(decimals, balanceString, prices[asset]);
            } catch (e) {
                console.log(`some error: ${e}`)
            }

            totalUsdValue += usdValue;
        }
    }

    return totalUsdValue;
}

async function getSPrimeHolders(chain = "arbitrum"){
        let chainId;
        let sPrimeHolders = [];

        if (chain === "arbitrum") {
            chainId = 42161;
        } else if (chain === "avalanche") {
            chainId = 43114;
        }

        let page = 1;
        let limit = 100;
        let hasMoreHolders = true;

        while (hasMoreHolders) {
            const url = `https://api.chainbase.online/v1/token/holders?chain_id=${chainId}&contract_address=${sPrimeUniswapAddress}&page=${page}&limit=${limit}`;
            const response = await fetch(url, {
                headers: {
                    "x-api-key": '2hjmIoJ2wPBnaBbEjjqMOLp0plz'
                }
            });
            const json = await response.json();

            if (json.data && json.data.length > 0) {
                sPrimeHolders = [...sPrimeHolders, ...json.data];
                page++;

                await new Promise((resolve, reject) => setTimeout(resolve, 600));
            } else {
                hasMoreHolders = false;
            }
        }

        sPrimeHolders = [...new Set(sPrimeHolders)];
        console.log(`Found ${sPrimeHolders.length} sPrime holders.`);

        return sPrimeHolders;
}

// Function to fetch balance
async function fetchBalance(address) {
    return sPrimeUniswapContract.balanceOf(address);
}

async function getHoldersBalances(holders){
    let holdersBalances = []
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return fetchBalance(address).then(balance => {
            return balance;
        });
    }, { concurrency: 300 }).then(results => {
        console.log('All balances fetched');
        holdersBalances = results.map(balance => Number(fromWei(balance)));
    }).catch(error => {
        console.error('Error fetching balances', error);
    });

    return holdersBalances;
}

async function isInRange(userAddress){
    return await sPrimeUniswapContract.tickInRange(userAddress);
}

async function getHoldersIsInRange(holders){
    let holdersInRange = []
    // Use Promise.map with concurrency option
    await Promise.map(holders, address => {
        return isInRange(address).then(inRange => {
            return inRange;
        });
    }, { concurrency: 300 }).then(results => {
        console.log('All in range fetched');
        holdersInRange = results;
    }).catch(error => {
        console.error('Error fetching in range', error);
    });

    return holdersInRange;
}

async function getSPrimeRevSharingUsersAllocationsArbitrum(epoch = 0, tokenDistributionAmount = 10000){

    let sPrimeTotalSupply = fromWei(await sPrimeUniswapContract.totalSupply());
    let sPrimeHolders = await getSPrimeHolders();

    let holdersBalances = await getHoldersBalances(sPrimeHolders);
    let holdersInRange = await getHoldersIsInRange(sPrimeHolders);

    // sum of balances
    let totalBalance = holdersBalances.reduce((a, b) => a + b, 0);
    console.log(`Total balance: ${totalBalance}`);
    console.log(`Total supply: ${sPrimeTotalSupply}`)
    console.log(`Difference: ${sPrimeTotalSupply - totalBalance}`);
    // number of holders not in range
    let holdersNotInRange = holdersInRange.filter(inRange => !inRange);
    console.log(`Holders not in range: ${holdersNotInRange.length}`);
    // sum of balances of holders not in range
    let totalBalanceNotInRange = holdersBalances.filter((_, index) => !holdersInRange[index]).reduce((a, b) => a + b, 0);
    console.log(`Total balance not in range: ${totalBalanceNotInRange}`);
    // number of holders in range
    let holdersInRangeCount = holdersInRange.filter(inRange => inRange).length;
    console.log(`Holders in range: ${holdersInRangeCount}`);
    // sum of balances of holders in range
    let totalBalanceInRange = holdersBalances.filter((_, index) => holdersInRange[index]).reduce((a, b) => a + b, 0);
    console.log(`Total balance in range: ${totalBalanceInRange}`);

    let userAllocations = {}
    let biggestTokenAmount = 0;
    for(let i=0; i<sPrimeHolders.length; i++){
        if(holdersInRange[i]){
            let tokenAmount = tokenDistributionAmount * holdersBalances[i] / totalBalanceInRange;
            if(tokenAmount > biggestTokenAmount){
                biggestTokenAmount = tokenAmount;
            }
            userAllocations[sPrimeHolders[i]] = tokenAmount;
        } else {
            userAllocations[sPrimeHolders[i]] = 0;
        }
    }


    const objArray = Object.entries(userAllocations);

    // Step 2: Sort the array by the values
    objArray.sort((a, b) => b[1] - a[1]);

    // Step 3: Convert the sorted array back into an object
    const sortedObj = Object.fromEntries(objArray);

    // save user allocations to a JSON file
    fs.writeFileSync(`arbitrum/sPrimeRevSharingAllocationEpoch${epoch}.json`, JSON.stringify(sortedObj, null, 2));
    console.log(`Biggest token amount: ${biggestTokenAmount}`);

}

async function checkFailedLiquidationTxsEvents(startTime, endTime) {
    // const startBlock = (await getBlockForTimestamp(startTime)).block;
    // const endBlock = (await getBlockForTimestamp(endTime)).block;
    const startBlock = 47970100;
    const endBlock = 48284253
    const liquidatorAddresses = [
        "0xD6F515Bf564F852939e2733f50a750e68e33E504",
        "0x0d25015D4567Cb6f450d58329bad6BC7eA718E67",
        "0x7e89663195f53CdaEc2F97a4CD9eC4606C5518e8",
        "0x8582FEc792dE46872fc69A5fF68A384b7f0C438D",
        "0xEBc567e074c954cE6FD370fD763E00A383E7005C",
    ];

    const txPerPage = 100;

    for(const liquidatorAddress of liquidatorAddresses){
        let result = [];
        let page = 1;
        while(true) {
            const url = `https://api.snowtrace.io/api?module=account&action=txlist` +
                `&address=${liquidatorAddress}` +
                `&startblock=${startBlock}` +
                `&endblock=${endBlock}` +
                `&page=${page}` +
                `&offset=${txPerPage}` +
                `&sort=asc`

            let apiResult = await getTxs(url);
            let partialResult = apiResult['result'];
            if(apiResult.length === 0){
                break;
            }
            result.push(...partialResult);
            if(partialResult.length < txPerPage){
                break;
            }
            page += 1;
        }

        let totalUsdValue = 0;

        for(const tx of result){
            if(tx['functionName'].includes('liquidateLoan')){
                if(tx['isError'] !== '1'){
                    const usdValue = await processSuccessfullLiquidationTx(tx);
                    totalUsdValue += usdValue;
                }
            }
        }
        console.log('totalUsdValue', totalUsdValue);

        await getSPrimeRevSharingUsersAllocationsArbitrum(0, totalUsdValue);
    }
}

checkFailedLiquidationTxsEvents(1720952696, 1721471096);
