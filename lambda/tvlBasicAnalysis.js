const ethers = require('ethers');
const {
    fromWei,
    formatUnits,
    arbitrumHistoricalProvider,
    getWrappedContractsHistorical,
    getArweavePackages,
} = require('./utils/helpers');
const TOKEN_ADDRESSES = require("../common/addresses/arbitrum/token_addresses.json");
const smartLoanFactoryAbi = require('../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json');

async function runMethod(contract, methodName, blockNumber) {
    const tx = await contract.populateTransaction[methodName]()
    let res = await contract.provider.call(tx, blockNumber)
    return contract.interface.decodeFunctionResult(
        methodName,
        res
    )[0];
}

async function checkTVL(blockNumber) {
    const USDC_POOL_TUP_CONTRACT = '0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0';
    const DAI_POOL_TUP_CONTRACT = '0xd5E8f691756c3d7b86FD8A89A06497D38D362540';
    const ARB_POOL_TUP_CONTRACT = '0x2B8C610F3fC6F883817637d15514293565C3d08A';
    const BTC_POOL_TUP_CONTRACT = '0x5CdE36c23f0909960BA4D6E8713257C6191f8C35';
    const ETH_POOL_TUP_CONTRACT = '0x0BeBEB5679115f143772CfD97359BBcc393d46b3';

    const smartLoanFactory = new ethers.Contract("0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20", smartLoanFactoryAbi.abi, arbitrumHistoricalProvider);

    const loansLength = await smartLoanFactory.getLoansLength();
    const primeAccounts = [];
    let batchSize = process.env.batchSize === undefined ? 100 : process.env.batchSize;
    for (let i = 0; i < Math.ceil(loansLength / batchSize); i++) {
        const pas = await smartLoanFactory.getLoans(i * batchSize, batchSize);
        primeAccounts.push(...pas);
    }

    const block = await arbitrumHistoricalProvider.getBlock(blockNumber);
    const timestamp = block.timestamp;
    const packages = await getArweavePackages(timestamp, 'arbitrum');

    const wrappedPAs = await getWrappedContractsHistorical(primeAccounts, 'arbitrum', packages);
    let FLSPromises = []

    let result = [];
    let batchResult = [];

    for (let i = 0; i < Math.ceil(wrappedPAs.length / batchSize); i++) {
        console.log(`Processing [${i * batchSize} - ${(i + 1) * batchSize > wrappedPAs.length ? wrappedPAs.length : (i + 1) * batchSize}] (${wrappedPAs.length - i * batchSize > batchSize ? batchSize : wrappedPAs.length - i * batchSize} PAs)`)
        let start = new Date();

        let batchWrappedPAs = wrappedPAs.slice(i * batchSize, (i + 1) * batchSize);
        FLSPromises = [];
        batchWrappedPAs.forEach((wpa) => FLSPromises.push(runMethod(wpa, 'getTotalValue', blockNumber)));
        batchResult = await Promise.all(FLSPromises)
        let end = new Date();
        console.log(`Processed in ${(end - start) / 1000}ms`)
        result = result.concat(batchResult)
    }

    let pasTvl = result.reduce((sum, paValue) => sum + fromWei(paValue), 0)

    console.log(`PAs Total $ value: ${pasTvl}`)

    let tvl = 0;

    let usdcToken = new ethers.Contract(TOKEN_ADDRESSES['USDC'], IERC20_ABI, arbitrumHistoricalProvider);
    let daiToken = new ethers.Contract(TOKEN_ADDRESSES['DAI'], IERC20_ABI, arbitrumHistoricalProvider);
    let arbToken = new ethers.Contract(TOKEN_ADDRESSES['ARB'], IERC20_ABI, arbitrumHistoricalProvider);
    let btcToken = new ethers.Contract(TOKEN_ADDRESSES['BTC'], IERC20_ABI, arbitrumHistoricalProvider);
    let ethToken = new ethers.Contract(TOKEN_ADDRESSES['ETH'], IERC20_ABI, arbitrumHistoricalProvider);

    const usdcPoolDollarValue = formatUnits(await usdcToken.balanceOf(USDC_POOL_TUP_CONTRACT), "6") * (await getPrice("USDC"))
    tvl += usdcPoolDollarValue
    // console.log(`USDC Pool $value: $${usdcPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const daiPoolDollarValue = formatUnits(await daiToken.balanceOf(DAI_POOL_TUP_CONTRACT), "18") * (await getPrice("DAI"))
    tvl += daiPoolDollarValue
    // console.log(`DAI Pool $value: $${daiPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const arbPoolDollarValue = formatUnits(await arbToken.balanceOf(ARB_POOL_TUP_CONTRACT), "18") * (await getPrice("ARB"))
    tvl += arbPoolDollarValue
    // console.log(`ARB Pool $value: $${arbPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const btcPoolDollarValue = formatUnits(await btcToken.balanceOf(BTC_POOL_TUP_CONTRACT), "8") * (await getPrice("BTC"))
    tvl += btcPoolDollarValue
    // console.log(`BTC.b Pool $value: $${btcPoolDollarValue}. Intermediate TVL: $${tvl}`);

    const ethPoolDollarValue = formatUnits(await ethToken.balanceOf(ETH_POOL_TUP_CONTRACT), "18") * (await getPrice("ETH"))
    tvl += ethPoolDollarValue
    // console.log(`WETH Pool $value: $${ethPoolDollarValue}. Intermediate TVL: $${tvl}`);

    console.log(`Total Pool TVL: $${tvl}`);

    console.log(`Total TVL: $${tvl + pasTvl}`);

    return tvl + pasTvl;
}

async function main() {
    let blockNumbers = [
        227457534,
        227802234,
        228146934,
        228491634,
        228836334,
        229181034,
        229525734,
        229870434,
        230215134,
        230559834,
        230904534,
        231249234,
        231593934,
        231938634,
    ];
    let tvl = 0;
    for (let i = 0; i < blockNumbers.length; i++) {
        tvl += await checkTVL(blockNumbers[i]);
    }

    console.log(`1 - 14 July Avg TVL:`, tvl / blockNumbers.length);

    blockNumbers = [
        232283334,
        232628034,
        232972734,
        233317434,
        233662134,
        234006834,
        234351534,
        234696234,
        235040934,
        235385634,
        235730334,
        236075034,
        236419734,
        236764434,
        237109134,
    ];
    tvl = 0;
    for (let i = 0; i < blockNumbers.length; i++) {
        tvl += await checkTVL(blockNumbers[i]);
    }

    console.log(`15-29 of July Avg TVL:`, tvl / blockNumbers.length);
}

main();
