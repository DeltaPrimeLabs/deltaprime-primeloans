const ethers = require('ethers');
const {
    fromWei,
    formatUnits,
    arbitrumHistoricalProvider,
    getWrappedContractsHistorical,
    getArweavePackages, getHistoricalTokenPrice,
} = require('./utils/helpers');
const TOKEN_ADDRESSES = require("../common/addresses/arbitrum/token_addresses.json");
const smartLoanFactoryAbi = require('../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json');
const erc20ABI = require('./abis/IERC20.json');
const REDSTONE_CACHE_LAYER_URLS = [
    "https://oracle-gateway-1.a.redstone.finance",
    "https://oracle-gateway-2.a.redstone.finance"
]

async function runMethod(contract, methodName, blockNumber) {
    const tx = await contract.populateTransaction[methodName]()
    let res = await contract.provider.call(tx, blockNumber)
    return contract.interface.decodeFunctionResult(
        methodName,
        res
    )[0];
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

const getRedstonePrices = async function (tokenSymbols) {
    const rs_cache_url = REDSTONE_CACHE_LAYER_URLS[process.env.rs_cache_layer_index ?? 0];
    const dataServiceId = process.env.dataServiceId ?? "redstone-arbitrum-prod";
    const url = `${rs_cache_url}/data-packages/latest/${dataServiceId}`

    const redstonePrices = await (await fetch(url)).json();

    let result = [];
    for (const symbol of tokenSymbols) {
        result.push(getPricesWithLatestTimestamp(redstonePrices, symbol));
    }
    return result;
}

const redstonePrices = {}

async function getPrice(asset) {
    if (!Object.keys(redstonePrices).includes(asset)) {
        redstonePrices[asset] = (await getRedstonePrices([asset]))[0];
    }
    return redstonePrices[asset]
}

async function checkTVL(blockNumber) {
    console.log(`Checking TVL for block ${blockNumber}`)

    const USDC_POOL_TUP_CONTRACT = '0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0';
    const DAI_POOL_TUP_CONTRACT = '0xd5E8f691756c3d7b86FD8A89A06497D38D362540';
    const ARB_POOL_TUP_CONTRACT = '0x2B8C610F3fC6F883817637d15514293565C3d08A';
    const BTC_POOL_TUP_CONTRACT = '0x5CdE36c23f0909960BA4D6E8713257C6191f8C35';
    const ETH_POOL_TUP_CONTRACT = '0x0BeBEB5679115f143772CfD97359BBcc393d46b3';

    const smartLoanFactory = new ethers.Contract("0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20", smartLoanFactoryAbi.abi, arbitrumHistoricalProvider);

    const loansLength = await smartLoanFactory.getLoansLength();

    let primeAccounts = await smartLoanFactory.getAllLoans();
    if(primeAccounts.length !== loansLength.toNumber()) {
        throw new Error('Loans length mismatch')
    }
    let batchSize = process.env.batchSize === undefined ? 100 : process.env.batchSize;
    // for (let i = 0; i < Math.ceil(loansLength / batchSize); i++) {
    //     const pas = await smartLoanFactory.getLoans(i * batchSize, batchSize);
    //     primeAccounts.push(...pas);
    // }

    const block = await arbitrumHistoricalProvider.getBlock(blockNumber);
    const timestamp = block.timestamp;
    const packages = await getArweavePackages(timestamp, 'arbitrum');

    const wrappedPAs = await getWrappedContractsHistorical(primeAccounts, 'arbitrum', packages);
    let FLSPromises = []

    let result = [];
    let batchResult = [];

    for (let i = 0; i < Math.ceil(wrappedPAs.length / batchSize); i++) {
        // console.log(`Processing [${i * batchSize} - ${(i + 1) * batchSize > wrappedPAs.length ? wrappedPAs.length : (i + 1) * batchSize}] (${wrappedPAs.length - i * batchSize > batchSize ? batchSize : wrappedPAs.length - i * batchSize} PAs)`)
        let start = new Date();

        let batchWrappedPAs = wrappedPAs.slice(i * batchSize, (i + 1) * batchSize);
        FLSPromises = [];

        batchWrappedPAs.forEach((wpa) => FLSPromises.push(runMethod(wpa, 'getTotalValue', blockNumber)));
        batchResult = await retryPromiseAll(FLSPromises, batchWrappedPAs, runMethod, blockNumber);

        let end = new Date();
        console.log(`Processed in ${(end - start) / 1000}s`)
        result = result.concat(batchResult)
    }

    let pasTvl = result.reduce((sum, paValue) => sum + fromWei(paValue), 0)

    console.log(`PAs Total $ value: ${pasTvl}`)

    let tvl = 0;

    let usdcToken = new ethers.Contract(TOKEN_ADDRESSES['USDC'], erc20ABI, arbitrumHistoricalProvider);
    let daiToken = new ethers.Contract(TOKEN_ADDRESSES['DAI'], erc20ABI, arbitrumHistoricalProvider);
    let arbToken = new ethers.Contract(TOKEN_ADDRESSES['ARB'], erc20ABI, arbitrumHistoricalProvider);
    let btcToken = new ethers.Contract(TOKEN_ADDRESSES['BTC'], erc20ABI, arbitrumHistoricalProvider);
    let ethToken = new ethers.Contract(TOKEN_ADDRESSES['ETH'], erc20ABI, arbitrumHistoricalProvider);
    let tokenPrice;

    const usdcBalanceCall = await usdcToken.populateTransaction.balanceOf(USDC_POOL_TUP_CONTRACT);
    const usdcBalanceResult = await usdcToken.provider.call(usdcBalanceCall, blockNumber);
    const usdcBalance = usdcToken.interface.decodeFunctionResult('balanceOf', usdcBalanceResult)[0];
    tokenPrice = await getHistoricalTokenPrice("USDC", timestamp);
    console.log(`USDC Price: ${tokenPrice}`)
    const usdcPoolDollarValue = formatUnits(usdcBalance, "6") * tokenPrice;
    tvl += usdcPoolDollarValue
    console.log(`USDC Pool $value: $${usdcPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const daiBalanceCall = await daiToken.populateTransaction.balanceOf(DAI_POOL_TUP_CONTRACT);
    const daiBalanceResult = await daiToken.provider.call(daiBalanceCall, blockNumber);
    const daiBalance = daiToken.interface.decodeFunctionResult('balanceOf', daiBalanceResult)[0];
    tokenPrice = await getHistoricalTokenPrice("DAI", timestamp);
    console.log(`DAI Price: ${tokenPrice}`)
    const daiPoolDollarValue = formatUnits(daiBalance, "18") * tokenPrice;
    tvl += daiPoolDollarValue;
    console.log(`DAI Pool $value: $${daiPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const arbBalanceCall = await arbToken.populateTransaction.balanceOf(ARB_POOL_TUP_CONTRACT);
    const arbBalanceResult = await arbToken.provider.call(arbBalanceCall, blockNumber);
    const arbBalance = arbToken.interface.decodeFunctionResult('balanceOf', arbBalanceResult)[0];
    tokenPrice = await getHistoricalTokenPrice("ARB", timestamp);
    console.log(`ARB Price: ${tokenPrice}`)
    const arbPoolDollarValue = formatUnits(arbBalance, "18") * tokenPrice;
    tvl += arbPoolDollarValue;
    console.log(`ARB Pool $value: $${arbPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const btcBalanceCall = await btcToken.populateTransaction.balanceOf(BTC_POOL_TUP_CONTRACT);
    const btcBalanceResult = await btcToken.provider.call(btcBalanceCall, blockNumber);
    const btcBalance = btcToken.interface.decodeFunctionResult('balanceOf', btcBalanceResult)[0];
    tokenPrice = await getHistoricalTokenPrice("BTC", timestamp);
    console.log(`BTC Price: ${tokenPrice}`)
    const btcPoolDollarValue = formatUnits(btcBalance, "8") * tokenPrice;
    tvl += btcPoolDollarValue;
    console.log(`BTC Pool $value: $${btcPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const ethBalanceCall = await ethToken.populateTransaction.balanceOf(ETH_POOL_TUP_CONTRACT);
    const ethBalanceResult = await ethToken.provider.call(ethBalanceCall, blockNumber);
    const ethBalance = ethToken.interface.decodeFunctionResult('balanceOf', ethBalanceResult)[0];
    tokenPrice = await getHistoricalTokenPrice("ETH", timestamp);
    console.log(`ETH Price: ${tokenPrice}`)
    const ethPoolDollarValue = formatUnits(ethBalance, "18") * tokenPrice;
    tvl += ethPoolDollarValue;
    console.log(`WETH Pool $value: $${ethPoolDollarValue}. Intermediate TVL: $${tvl}`);

    console.log(`Total Pool TVL: $${tvl}`);

    console.log(`Total TVL for block ${blockNumber}: $${tvl + pasTvl}`);

    return tvl + pasTvl;
}

async function retryPromiseAll(promises, batchWrappedPAs, runMethod, blockNumber, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await Promise.all(promises.map(p => p.catch(() => 0)));
        } catch (error) {
            if (i === retries - 1) {
                throw error;
            }
            console.log(`Retrying batch... Attempt ${i + 1} of ${retries}`);
            // Clear and repopulate the promises array
            promises.length = 0;
            batchWrappedPAs.forEach((wpa) => promises.push(runMethod(wpa, 'getTotalValue', blockNumber).catch(() => 0)));
        }
    }
}

async function main() {
    let blockNumbers = [
        // 227457534,
        // 227802234,
        // 228146934,
        // 228491634,
        // 228836334,
        // 229181034,
        // 229525734,
        // 229870434,
        // 230215134,
        // 230559834,
        // 230904534,
        // 231249234,
        // 231593934,
        // 231938634,
    ];
    let tvl = 0;
    for (let i = 0; i < blockNumbers.length; i++) {
        tvl += await checkTVL(blockNumbers[i]);
    }

    console.log(`1 - 14 July Avg TVL:`, tvl / blockNumbers.length);

    blockNumbers = [
        // 232283334,
        // 232628034,
        // 232972734,
        // 233317434,
        // 233662134,
        // 234006834,
        // 234351534,
        // 234696234,
        // 235040934,
        // 235385634,
        // 235730334,
        // 236075034,
        // 236419734,
        // 236764434,
        237109134,
    ];
    tvl = 0;
    for (let i = 0; i < blockNumbers.length; i++) {
        tvl += await checkTVL(blockNumbers[i]);
    }

    console.log(`15-29 of July Avg TVL:`, tvl / blockNumbers.length);
}

main();
