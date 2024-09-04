const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";
const fetch = require("node-fetch");
const cliProgress = require('cli-progress');


const FACTORY_ARTIFACT = require(`./artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json`);
const fs = require("fs");
const fsAsync = require('fs').promises;
const path = require('path');
const ethers = require("ethers");
const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let factory = new ethers.Contract('0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20', FACTORY_ARTIFACT.abi, wallet);


let collectedTotal = 0;

const {
    dynamoDb,
    fetchAllDataFromDB, arbitrumProvider
} = require('./lambda/utils/helpers');
const FACTORY = require("./lambda/abis/SmartLoansFactory.json");
const funcRpc = require("./lambda/.secrets/funcRpc.json");

const getIncentives = async (from, to) => {
    try {
        let params = {
            TableName: 'arbitrum-incentives-arb-prod',
            FilterExpression: '#timestamp >= :from AND #timestamp <= :to',
            ExpressionAttributeNames: {
                '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':from': from,
                ':to': to
            }
        };

        return await fetchAllDataFromDB(params, true, 100);

    } catch (error) {
        console.error(error);
        return;
    };
}

const getIncentivesForAccount = async (address) => {
    try {
        const params = {
            TableName: 'arbitrum-incentives-arb-prod',
            KeyConditionExpression: 'id = :paAddress',
            ExpressionAttributeValues: {
                ':paAddress': address.toLowerCase()
            }
        };


        return await fetchAllDataFromDB(params, false);

    } catch (error) {
        console.error(error);
        return;
    };
}

const getLtipEligibleTvlHistory = async () => {
    try {
        let params = {
            TableName: 'loan-eligible-tvl-arb-prod',
        };

        return await fetchAllDataFromDB(params, true);

    } catch (error) {
        console.error(error);
        return;
    };
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Timeout function that rejects after a specified time
function timeout(ms) {
    return new Promise((resolve, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
}

let currentSleepTimeMs = 0;
async function promiseAllInBatches(task, items, batchSize) {
    let position = 0;
    let results = [];
    while (position < items.length) {

        console.log(`Processing from position ${position} to ${batchSize}`)
        const itemsForBatch = items.slice(position, position + batchSize);
        currentSleepTimeMs = 0;
        results = [...results, ...await runWithTimeout(itemsForBatch.map(item => task(item)), 20000)];


        position += batchSize;
        // sleep 30 seconds with promise timeout
        // await new Promise(resolve => setTimeout(resolve, 10000));
    }
    return results;
}

async function runWithTimeout(promises, timeoutMs) {
    try {
        // Race the promises against a timeout
        return await Promise.race([
            Promise.all(promises),
            timeout(timeoutMs)
        ]);
    } catch (error) {
        if (error.message === 'Timeout') {
            if(currentSleepTimeMs < 15000){
                currentSleepTimeMs += 5000;
            } else {
                currentSleepTimeMs = 0;
            }
            console.log(`Operation timed out, retrying after ${currentSleepTimeMs/1000}seconds...`);
            await sleep(currentSleepTimeMs); // Sleep for 5000 milliseconds (5 seconds)
            return await runWithTimeout(promises, timeoutMs); // For automatic retry
        }
        throw error; // For other errors
    }
}


const MILESTONES = [
    7500000,
    10000000,
    12500000,
    15000000,
    17500000
];

async function calculateSpeedBonuses() {
    const milestonesHit = {};
    const START_OF_LTIP = 1717432200;
    const END_OF_LTIP = 1724689800;
    // const END_OF_LTIP = 1718641800; // For testing = 17 June 2024 16:30:00
    const INTERVAL = 3600;
    const _7_DAYS = 7 * 24 * 3600;
    const SPEED_BONUS_INCENTIVES = 8333;
    let eligibleTvlCsv = '';

    let currentMilestoneIndex = 0;
    let currentMilestone = MILESTONES[currentMilestoneIndex];
    let timestamp = START_OF_LTIP;
    let lastMilestoneHit = START_OF_LTIP;
    const dir = 'speed-bonuses';
    let csvFileData = '';

    const tvlHistory = await getLtipEligibleTvlHistory();
    tvlHistory.sort((a,b) => a.id - b.id);

    for (let tvlPoint of tvlHistory) {
        if (tvlPoint.id > END_OF_LTIP) {
            break;
        }

        eligibleTvlCsv += `${tvlPoint.id},${tvlPoint.totalEligibleTvl}\n`;

        console.log(`${tvlPoint.id} ${tvlPoint.totalEligibleTvl}`)
        let timeSinceLastMilestone = tvlPoint.id - lastMilestoneHit;

        //MILESTONE HIT
        if (tvlPoint.totalEligibleTvl > currentMilestone && (timeSinceLastMilestone <= _7_DAYS) && !milestonesHit[currentMilestone]) {
            const collected = await getIncentives(tvlPoint.id - 1799, tvlPoint.id + 1800);
            const sumCollected = collected.reduce((a,b) => a + b.arbCollected, 0);

            // let totalIncentives = SPEED_BONUS_INCENTIVES *  (_7_DAYS - timeSinceLastMilestone) / _7_DAYS;
            let totalIncentives = 6220;

            let csvFileData = `Timestamp,${timestamp}\nLast milestone timestamp,${lastMilestoneHit}\nCurrent milestone,${currentMilestone}\nTotal incentives,${totalIncentives}\n\n`
            +`Prime account,Eligible TVL,Incentives\n`;

            let jsonFileData = {};

            for (let primeAccount of collected) {
                const paEligibleTvl = tvlPoint.totalEligibleTvl * primeAccount.arbCollected / sumCollected;
                const incentives = totalIncentives * paEligibleTvl / tvlPoint.totalEligibleTvl;

                csvFileData += `${primeAccount.id},${paEligibleTvl},${incentives}\n`;
                jsonFileData[primeAccount.id] = incentives;
            }

            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir);
            }

            fs.writeFileSync(`${dir}/${currentMilestone}-${timestamp}.csv`, csvFileData);
            fs.writeFileSync(`${dir}/${currentMilestone}-${timestamp}.json`, JSON.stringify(jsonFileData));
        }

        if (tvlPoint.totalEligibleTvl > currentMilestone) {
            console.log(`Milestone hit: ${currentMilestone} at ${tvlPoint.id}`);
            console.log(`Time since last milestone: ${timeSinceLastMilestone} (in days: ${timeSinceLastMilestone / 86400})`);

            milestonesHit[currentMilestone] = true;
            currentMilestoneIndex++;
            currentMilestone = MILESTONES[currentMilestoneIndex];
            lastMilestoneHit = tvlPoint.id;
        }

    }

    fs.writeFileSync(`${dir}/eligible-tvl.csv`, eligibleTvlCsv);

}

const cache = new Map();

let cacheForIncentives = {};
let cacheForIncentivesInitialized = false;

async function getCachedIncentives(startTime, endTime, filename = 'incentivesCache.json') {
    const cacheKey = `${startTime}-${endTime}`;
    const filePath = path.resolve(__dirname, filename);

    if(!cacheForIncentivesInitialized){
        try {
            // Try to read the cache file
            const data = await fsAsync.readFile(filePath, { encoding: 'utf8' });
            cacheForIncentives = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') {
                // If there is another type of error, rethrow it
                throw err;
            }
        }
        cacheForIncentivesInitialized = true;
    }

    // Check if the cacheKey exists in the cache file
    if (cacheForIncentives[cacheKey]) {
        // Cache hit: return the cached result
        console.log(`Cache hit for ${cacheKey}`);
        return cacheForIncentives[cacheKey];
    }



    // Cache miss: fetch the data
    const result = await getIncentives(startTime, endTime);

    // Store the result in the cache
    cacheForIncentives[cacheKey] = result;

    // Write the updated cache back to the JSON file
    await fsAsync.writeFile(filePath, JSON.stringify(cacheForIncentives, null, 2), { encoding: 'utf8' });

    // Return the fetched result
    return result;
}

async function getTvlHistoryWithCache(filename = 'tvlHistory.json') {
    const filePath = path.resolve(__dirname, filename);

    try {
        // Try to read the file
        let data = await fsAsync.readFile(filePath, 'utf8');
        // Parse the JSON data
        data =  JSON.parse(data);

        return data.sort((a,b) => a.id - b.id);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // File doesn't exist, so call the method to get the data
            let tvlHistory = await getLtipEligibleTvlHistory();
            tvlHistory = tvlHistory.sort((a,b) => a.id - b.id);

            // Save the data to a local JSON file
            await fsAsync.writeFile(filePath, JSON.stringify(tvlHistory, null, 2), 'utf8');

            // Return the fetched data
            return tvlHistory;
        } else {
            // If there is another type of error, rethrow it
            throw err;
        }
    }
}

async function getCachedIncentivesForLoan(loan, filename = 'incentivesCacheForLoan.json') {
    const filePath = path.resolve(__dirname, filename);

    let cache = {};

    try {
        // Try to read the file
        const data = await fsAsync.readFile(filePath, { encoding: 'utf8' });
        cache = JSON.parse(data);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            // If there is another type of error, rethrow it
            throw err;
        }
    }

    // Check if the loan entry exists in the cache
    if (cache[loan]) {
        console.log(`Cache hit for loan ${loan}`);
        return cache[loan];
    }

    // If the entry doesn't exist, fetch the data
    let incentives = await getIncentivesForAccount(loan);
    incentives = incentives.sort((a,b) => a.timestamp - b.timestamp)

    // Save the fetched data to the cache object
    cache[loan] = incentives;

    // Save the updated cache to the JSON file
    await fsAsync.writeFile(filePath, JSON.stringify(cache, null, 2), { encoding: 'utf8' });

    // Return the fetched data
    return incentives;
}

async function calculateRetentionBonuses() {
    const START_OF_LTIP = 1717432200;
    const END_OF_LTIP = 1724689800;

    let timestamp = START_OF_LTIP;
    let lastMilestoneHit = START_OF_LTIP;
    const dir = 'retention-bonuses';

    const tvlHistory = await getTvlHistoryWithCache();

    let loans = await factory.getAllLoans();

    let minMaxTvl = 0;
    let minMaxTvlTime = 0;
    let timeWindow = 3600 * 24 * 7 * 8;

    let accountsEligibleTvlsOverTime = {};

    const progressBar = new cliProgress.SingleBar({
        format: 'Progress |{bar}| {percentage}% | ETA: {eta}s | {value}/{total}',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(loans.length, 0); // Start the progress bar

    let i = 0;
    for (let loan of loans) {
        const startTime = Date.now();

        let history = await getCachedIncentivesForLoan(loan);


        // filter out results that are outside of the LTIP period
        history = history.filter(dataPoint => dataPoint.timestamp >= START_OF_LTIP && dataPoint.timestamp <= END_OF_LTIP);

        // log number of data points for loan
        // console.log(`Loan ${loan} has ${history.length} data points`);

        let prevUsedHistoricalTvl = tvlHistory[0].totalEligibleTvl;
        let historyPointsCount = 0;
        for (let dataPoint of history) {
            historyPointsCount++;
            console.log(`Processing loan ${loan} data point ${historyPointsCount} of ${history.length}`);

            const TIMESTAMP_WINDOW_MULTIPLIER = 1;

            const collected = await getCachedIncentives(dataPoint.timestamp - (TIMESTAMP_WINDOW_MULTIPLIER*1800) - 1, dataPoint.timestamp + TIMESTAMP_WINDOW_MULTIPLIER * 1800);

            const sumCollected = collected.reduce((a,b) => a + b.arbCollected, 0);

            const TVL_HISTORY_WINDOW_WIDTH = 3

            let point = tvlHistory.find((el, i) => tvlHistory[i + TVL_HISTORY_WINDOW_WIDTH] && tvlHistory[i - TVL_HISTORY_WINDOW_WIDTH + 1] && tvlHistory[i + TVL_HISTORY_WINDOW_WIDTH].id > dataPoint.timestamp && tvlHistory[i - TVL_HISTORY_WINDOW_WIDTH + 1].id < dataPoint.timestamp)
            if(!point){
                console.log(`No TVL data found for timestamp ${dataPoint.timestamp}. Using previous TVL data. ${prevUsedHistoricalTvl}`);
                point = {
                    totalEligibleTvl: prevUsedHistoricalTvl
                }
            } else {
                prevUsedHistoricalTvl = point.totalEligibleTvl;
            }
            const totalEligibleTvl = point.totalEligibleTvl;
            const paEligibleTvl = totalEligibleTvl * dataPoint.arbCollected / sumCollected;

            // if (((paEligibleTvl < minMaxTvl && (dataPoint.timestamp - minMaxTvlTime) < timeWindow))
            //     || (paEligibleTvl < minMaxTvl && (dataPoint.timestamp - minMaxTvlTime) > timeWindow)
            //     || i === 0) {
            //     minMaxTvl = paEligibleTvl;
            //     minMaxTvlTime = dataPoint.timestamp;
            // }

            // console.log(`paEligibleTvl: ${paEligibleTvl}, minMaxTvl: ${minMaxTvl},  minMaxTvlTime: ${minMaxTvlTime},`)
            if(!accountsEligibleTvlsOverTime[loan]){
                accountsEligibleTvlsOverTime[loan] = [
                    {
                        timestamp: dataPoint.timestamp,
                        tvl: paEligibleTvl
                    }
                ];
            } else {
                accountsEligibleTvlsOverTime[loan].push({
                    timestamp: dataPoint.timestamp,
                    tvl: paEligibleTvl
                });
            }
        }

        i++;

        const endTime = Date.now();
        const elapsed = endTime - startTime;
        progressBar.increment(1, { eta: ((loans.length - i - 1) * elapsed) / 1000 });


    }

    progressBar.stop(); // Stop the progress bar
    // save accountsEligibleTvlsOverTime to json file
    fs.writeFileSync('accountsEligibleTvlsOverTime.json', JSON.stringify(accountsEligibleTvlsOverTime));
}


function arrayToCSVRow(data) {
    const csvRows = [];

    for (const row of data) {
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

// Function to find the highest minimum TVL over a sliding time window
async function calculateHighestMinTvl(filename, windowSizeInSeconds = 8 * 7 * 24 * 60 * 60) {
    const filePath = path.resolve(__dirname, filename);

    // Read the JSON file
    const data = await fsAsync.readFile(filePath, { encoding: 'utf8' });
    const accounts = JSON.parse(data);

    const result = {};

    // Iterate over each account in the JSON file
    for (const account in accounts) {
        const tvlData = accounts[account];

        let highestMinTvl = -Infinity;

        // Sort data by timestamp just in case it's not sorted
        tvlData.sort((a, b) => a.timestamp - b.timestamp);

        // Iterate over each possible window start time
        for (let i = 0; i < tvlData.length; i++) {
            const windowStart = tvlData[i].timestamp;
            const windowEnd = windowStart + windowSizeInSeconds;

            // Get all tvl entries within this time window
            const windowTvl = tvlData
                .filter(entry => entry.timestamp >= windowStart && entry.timestamp <= windowEnd)
                .map(entry => entry.tvl);

            if (windowTvl.length > 0) {
                const minTvlInWindow = Math.min(...windowTvl);
                if (minTvlInWindow > highestMinTvl) {
                    highestMinTvl = minTvlInWindow;
                }
            }
        }

        // Save the highest min TVL found for this account
        result[account] = highestMinTvl;
    }

    // Write the results to a new JSON file
    const resultFilePath = path.resolve(__dirname, 'highestMinTvlResult4Weeks.json');
    await fsAsync.writeFile(resultFilePath, JSON.stringify(result, null, 2), { encoding: 'utf8' });

    console.log('Results written to', resultFilePath);
}

async function distributeTokensBasedOnTvl(filename, totalTokensToDistribute) {
    const filePath = path.resolve(__dirname, filename);

    // Read the JSON file with the highest min TVL data
    const data = await fsAsync.readFile(filePath, { encoding: 'utf8' });
    const tvlData = JSON.parse(data);

    // Calculate the total TVL of all addresses
    const totalTvl = Object.values(tvlData).reduce((sum, tvl) => sum + tvl, 0);

    const tokenDistribution = {};

    // Calculate the token distribution for each address
    for (const [address, tvl] of Object.entries(tvlData)) {
        const share = tvl / totalTvl;
        const tokens = share * totalTokensToDistribute;
        tokenDistribution[address] = tokens;
    }

    // Write the token distribution to a new JSON file
    const resultFilePath = path.resolve(__dirname, 'tokenDistribution4Weeks.json');
    await fsAsync.writeFile(resultFilePath, JSON.stringify(tokenDistribution, null, 2), { encoding: 'utf8' });

    console.log('Token distribution written to', resultFilePath);
}

// Example usage
const filename = 'accountsEligibleTvlsOverTime.json'; // JSON file containing the TVL data
const filename8Weeks = 'highestMinTvlResult8Weeks.json'; // JSON file containing the highest min TVLs
const filename4Weeks = 'highestMinTvlResult4Weeks.json'; // JSON file containing the highest min TVLs
const windowSizeInSeconds8Weeks = 8 * 7 * 24 * 60 * 60; // 8 weeks in seconds
const windowSizeInSeconds4Weeks = 4 * 7 * 24 * 60 * 60; // 8 weeks in seconds
const totalTokensToDistribute = 93780; // Total number of tokens to distribute
const tokensFor8WeeksWindow = 0.75 * totalTokensToDistribute; // 75% of the total tokens
const tokensFor4WeeksWindow = 0.25 * totalTokensToDistribute; // 25% of the total tokens

// calculateSpeedBonuses()
// calculateRetentionBonuses()
// calculateHighestMinTvl(filename, windowSizeInSeconds4Weeks)
//     .catch(err => console.error(err));
distributeTokensBasedOnTvl(filename, filename4Weeks)
    .catch(err => console.error(err));
