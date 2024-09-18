const jsonRPC = "https://nd-820-127-885.p2pify.com/eb20dbbf452bafebd4ea76aa69c6629e"; // historical data

const ethers = require("ethers");

const PoolAbi = [
    'function balanceOf(address user) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function decimals() external view returns (uint256)',
]

const poolMapping = {
    "BtcPoolTUP": "0x5CdE36c23f0909960BA4D6E8713257C6191f8C35",
    "DaiPoolTUP": "0xd5E8f691756c3d7b86FD8A89A06497D38D362540",
    "UsdcPoolTUP": "0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0",
    "WethPoolTUP": "0x0BeBEB5679115f143772CfD97359BBcc393d46b3",
    "ArbPoolTUP": "0x2B8C610F3fC6F883817637d15514293565C3d08A",
};

function poolNameToTokenDollarValue(poolName) {
    switch (poolName) {
        case "BtcPoolTUP":
            return 58602;
        case "DaiPoolTUP":
            return 1;
        case "UsdcPoolTUP":
            return 1;
        case "WethPoolTUP":
            return 2357;
        case "ArbPoolTUP":
            return 0.51;
        default:
            return 1;
    }
}

async function getPoolHistoricalTVL(poolName, poolAddress, blockNumber){
    const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
    const poolContract = new ethers.Contract(poolAddress, PoolAbi, provider);
    const poolDecimals = await poolContract.decimals();
    let historicalTVL = await poolContract.totalSupply({blockTag: blockNumber});
    historicalTVL = ethers.utils.formatUnits(historicalTVL, poolDecimals);

    return historicalTVL;
}

let tokensWithdrawnAfterExploitPerPool = {
    "BtcPoolTUP": [
        0.00165829,
        0.00052189,
        0.01,
        0.00142474,
        0.001,
        0.002,
        0.0005,

    ],
    "DaiPoolTUP": [0],
    "UsdcPoolTUP": [
        9335.304003,
        21.689466,
        380.492177,
        346.273414,
        10047,
        100,
        500,
        1000,
        1000,
        1310.649946,
        0.011158,
        0.476889,
        581.02563,
        5060.582367,
        1,
        765.294367,
        10,
        10000,
        10000,
        5,
        1000,
        20000,
        5000,
        1000,
        1000,
        3.032029,
        584.850968,
        1000,
        400,
        200,
        100,
        50,
        40,
        1,
        65,
        64,
        63,
        62,
        47
    ],
    "WethPoolTUP": [
        0.01,
        2.1416970338537067,
        1.5605058508524177,
        0.6,
        14.389068010620907,
        0.030351847739811113,
        4.020350579614076,
        7.078472240745223,
        2.2265439833370126,
        2.2567446505922146,
        1.3186797866642066,
        2.613600314085689,
        0.5296755335863058,
        1.7097140004988285,
        1.232730438845738,
        0.9513550152797303,
        0.1581649507779418,
        0.013329417636149978,
        0.21088653926993117,
        0.06382765362998064,
        0.10547723029449034,
        1,
        0.3,
        0.0004,
        0.01,
        0.1,
        0.05,
        0.11,
        0.02,
        0.03,
        0.00199999,
        0.05,
        0.02,
        0.002,
        0.001,
        0.005,
        0.00275924315869511,
    ],
    "ArbPoolTUP": [
        1055.6085165600016,
        643.6630540679483,
        1640,
        643.6726835489847,
        0.1,
        937.0356392551819,
        448.65637736093777,
        236.42229376320952,
        0.000000000000000648,
        400,
        5,
        0.47,
        513.6513971789642,
        862.6459215491665,
        23.072749240848875,
        2430.1747258551122,
        242,
        4.681077945866865,
        939.0312699312071,
        8
    ],
}

function getTotalTokensWithdrawnAfterExploit(poolName){
    let totalTokensWithdrawn = 0;
    for (let i = 0; i < tokensWithdrawnAfterExploitPerPool[poolName].length; i++) {
        totalTokensWithdrawn += tokensWithdrawnAfterExploitPerPool[poolName][i];
    }

    return totalTokensWithdrawn;
}

async function getPoolCurrentTVL(poolName, poolAddress){
    const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
    const poolContract = new ethers.Contract(poolAddress, PoolAbi, provider);
    const poolDecimals = await poolContract.decimals();
    let currentTVL = await poolContract.totalSupply();
    currentTVL = ethers.utils.formatUnits(currentTVL, poolDecimals);

    return currentTVL;
}

async function main() {
    let data = [];
    let blockBeforeExploit = 253995272;
    let lastWithdrawBlockNumberPerPool = {
        "BtcPoolTUP": 254021502 + 1,
        "DaiPoolTUP": 253995304 + 1,
        "UsdcPoolTUP": 254031212 + 1,
        "WethPoolTUP": 254031778 + 1,
        "ArbPoolTUP": 254029099 + 1,
    }

    let totalHisotricalUsdTvl = 0;
    let totalUsdDiff = 0;

    for (const poolName in poolMapping) {
        const poolAddress = poolMapping[poolName];
        // let historicalTVL = await getPoolHistoricalTVL(poolName, poolAddress, blockBeforeExploit);
        // let tvlAfterExploit = await getPoolHistoricalTVL(poolName, poolAddress, lastWithdrawBlockNumberPerPool[poolName]);
        // let tokenDollarValue = poolNameToTokenDollarValue(poolName);
        // let historicalTVLUSD = historicalTVL * tokenDollarValue;
        // let tvlUsdAfterExploit = tvlAfterExploit * tokenDollarValue;
        // let usdDiff = tvlUsdAfterExploit - historicalTVLUSD;
        // let usdDiffPercentage = (usdDiff / historicalTVLUSD) * 100;
        //
        // totalHisotricalUsdTvl += historicalTVLUSD;
        // totalUsdDiff += usdDiff;
        //
        // //log with labels
        // console.log(`Pool Name: ${poolName}`);
        // console.log(`Pool Address: ${poolAddress}`);
        // console.log(`Historical TVL: ${historicalTVL}`);
        // console.log(`TVL after explit: ${tvlAfterExploit}`);
        // console.log(`Token Dollar Value: $${tokenDollarValue}`);
        // console.log(`Historical TVL USD: $${historicalTVLUSD}`);
        // console.log(`TVL USD after exploit: $${tvlUsdAfterExploit}`);
        // console.log(`USD Diff: $${usdDiff}`);
        // console.log(`USD Diff Percentage: %${usdDiffPercentage}`);
        // console.log(`\n`);

        let totalTokensWithdrawn = getTotalTokensWithdrawnAfterExploit(poolName);
        let tokenDollarValue = poolNameToTokenDollarValue(poolName);
        let totalTokensWithdrawnUSD = totalTokensWithdrawn * tokenDollarValue;
        console.log(`Pool Name: ${poolName} -> withdrawn: ${totalTokensWithdrawn} -> USD: $${totalTokensWithdrawnUSD}`);
    }

    // console.log(`Total Historical TVL: $${totalHisotricalUsdTvl}`);
    // console.log(`Total USD Diff: $${totalUsdDiff}`);
}
main();
