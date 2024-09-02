const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";
const fetch = require("node-fetch");
const cliProgress = require('cli-progress');


const FACTORY_ARTIFACT = require(`./artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json`);
const fs = require("fs");
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

    console.time('getLtipEligibleTvlHistory');
    const tvlHistory = await getLtipEligibleTvlHistory();
    console.timeEnd('getLtipEligibleTvlHistory');
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
            console.time('getIncentives');
            const collected = await getIncentives(tvlPoint.id - 1799, tvlPoint.id + 1800);
            console.timeEnd('getIncentives');
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

async function getCachedIncentives(startTime, endTime) {
    const cacheKey = `${startTime}-${endTime}`;

    if (cache.has(cacheKey)) {
        // console.log(`Cache hit for ${cacheKey}`);
        return cache.get(cacheKey);
    }

    // console.log(`Cache miss for ${cacheKey}`);
    const result = await getIncentives(startTime, endTime);
    cache.set(cacheKey, result);

    return result;
}

async function calculateRetentionBonuses() {
    const START_OF_LTIP = 1717432200;
    const END_OF_LTIP = 1724689800;

    let timestamp = START_OF_LTIP;
    let lastMilestoneHit = START_OF_LTIP;
    const dir = 'retention-bonuses';

    const tvlHistory = await getLtipEligibleTvlHistory();
    tvlHistory.sort((a,b) => a.id - b.id);

    for(let i = 0; i < tvlHistory.length; i++){
        // if diff is higher than 3601, log the timestamps
        if(tvlHistory[i + 1] && Math.abs(tvlHistory[i].id - tvlHistory[i + 1].id) > 7200){
            console.log(`Timestamps: ${tvlHistory[i].id} - ${tvlHistory[i + 1].id} -> diff: ${Math.abs(tvlHistory[i].id - tvlHistory[i + 1].id)} seconds`);
        }
    }

    console.log(tvlHistory[0].id)
    console.log(tvlHistory[tvlHistory.length - 1].id)

    throw new Error('Check timestamps');

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

    for (let loan of loans) {
        const startTime = Date.now();


        let history = await getIncentivesForAccount(loan);
        history.sort((a,b) => a.timestamp - b.timestamp)
        // filter out results that are outside of the LTIP period
        history = history.filter(dataPoint => dataPoint.timestamp >= START_OF_LTIP && dataPoint.timestamp <= END_OF_LTIP);

        // log number of data points for loan
        // console.log(`Loan ${loan} has ${history.length} data points`);

        let i = 0;
        let prevUsedHistoricalTvl = tvlHistory[0].totalEligibleTvl;
        for (let dataPoint of history) {
            const collected = await getCachedIncentives(dataPoint.timestamp - 1799, dataPoint.timestamp + 1800);

            const sumCollected = collected.reduce((a,b) => a + b.arbCollected, 0);

            let point = tvlHistory.find((el, i) => tvlHistory[i + 1] && tvlHistory[i + 1].id > dataPoint.timestamp && tvlHistory[i].id < dataPoint.timestamp)
            if(!point && dataPoint.timestamp > tvlHistory[0].id){
                console.log(`No TVL data found for timestamp ${dataPoint.timestamp}. Using previous TVL data.`);
                point = {
                    totalEligibleTvl: prevUsedHistoricalTvl
                }
            } else {
                prevUsedHistoricalTvl = point ? point.totalEligibleTvl : tvlHistory[0].totalEligibleTvl;
            }
            const totalEligibleTvl = point ? point.totalEligibleTvl : tvlHistory[0].totalEligibleTvl;
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

            i++;
        }

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

// calculateSpeedBonuses()
calculateRetentionBonuses()