const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";
const fetch = require("node-fetch");

const FACTORY_ARTIFACT = require(`../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json`);
const fs = require("fs");
const ethers = require("ethers");
const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let factory = new ethers.Contract('0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20', FACTORY_ARTIFACT.abi, wallet);


let collectedTotal = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Timeout function that rejects after a specified time
function timeout(ms) {
    return new Promise((resolve, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
}


async function fetchData(epochName, from, to, top, pool = false) {
    let type = pool ? 'pool' : 'loan';
    let resp = await fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-${type}-leaderboard?top=${top}&from=${from}&to=${to}`)
    let fileName = epochName + (pool ? '_SAVINGS' : '');
    console.log(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-${type}-leaderboard?from=${from}&to=${to}`)

    let list = (await resp.json()).list;
    console.log(list)

    let json = {};
    list.forEach(el => json[el.id] = el.arbCollected)

    fs.writeFileSync(`src/data/arbitrum/ltip/${fileName}.json`, JSON.stringify(json))

    let collectedArb = 0;

    let json1 = JSON.parse(fs.readFileSync(`src/data/arbitrum/ltip/${fileName}.json`))


    Object.values(json1).forEach(
        v => {
            collectedArb += v;
        }
    )

    console.log('collected ARB: ', collectedArb)
}

async function fetchLoansDataInBatches(epochName) {
    let pool = false;
    let type = 'loan';
    let fileName = epochName + (pool ? '_SAVINGS' : '');
    let loans = await factory.getAllLoans();

    const task = (address) => fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-${type}-for?addresses=${address}`)

    console.log(`LONS: ${loans.length}`)
    loans = loans.slice(0, 2200);

    let resps = await promiseAllInBatches(task, loans, 100);

    let jsons = await Promise.all(resps.map(json => json.json()))


    let json = {};
    console.log(jsons)
    jsons.forEach((j, i) => {
        json[loans[i].toLowerCase()] = j.data[loans[i]].arbCollected
    })
    fs.writeFileSync(`src/data/arbitrum/ltip/${fileName}.json`, JSON.stringify(json))

    let collectedArb = 0;

    let json1 = JSON.parse(fs.readFileSync(`src/data/arbitrum/ltip/${fileName}.json`))


    Object.values(json1).forEach(
        v => {
            collectedArb += v;
        }
    )

    console.log('collected ARB: ', collectedArb)
}

async function fetchPoolsDataInBatches(epochName, previousFiles) {
    let pool = true;
    let type = 'pool';
    let fileName = epochName + (pool ? '_SAVINGS' : '') + "_TOTAL";
    let pools = [];

    for (let file of previousFiles) {
        let json = JSON.parse(fs.readFileSync(`src/data/arbitrum/ltip/${file}.json`));
        for (let [pool, value] of Object.entries(json)) {
            if (pools.indexOf(pool) === -1) {
                pools.push(pool);
            }
        }
    }

    const task = (address) => fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/ltip-${type}-for?addresses=${address}`)

    console.log(`POOLS: ${pools.length}`)
    pools = pools.slice(0, 3000);

    let resps = await promiseAllInBatches(task, pools, 100);

    let jsons = await Promise.all(resps.map(json => json.json()))


    let json = {};
    console.log(jsons)
    jsons.forEach((j, i) => {
        json[pools[i].toLowerCase()] = j.data[pools[i]].arbCollected
    })
    fs.writeFileSync(`src/data/arbitrum/ltip/${fileName}.json`, JSON.stringify(json))

    let collectedArb = 0;

    let json1 = JSON.parse(fs.readFileSync(`src/data/arbitrum/ltip/${fileName}.json`))


    Object.values(json1).forEach(
        v => {
            collectedArb += v;
        }
    )

    console.log('collected ARB: ', collectedArb)
}

function createDiffJson(file1, file2, location = 'avalanche') {
    let json0 = JSON.parse(fs.readFileSync(`src/data/${location}/${file1}.json`))
    let json1 = JSON.parse(fs.readFileSync(`src/data/${location}/${file2}.json`))
    let json2 = {};

    let collectedAvax = 0;
    Object.entries(json1).forEach(
        ([k,v]) => {
            json2[k] = json1[k] - (json0[k] ? json0[k] : 0)
            collectedAvax += json2[k];
        }
    )

    fs.writeFileSync(`src/data/${location}/${file2}_diff_2.json`, JSON.stringify(json2))

    console.log('distributed Avax in this epoch: ', collectedAvax)

}

let currentSleepTimeMs = 0;
async function promiseAllInBatches(task, items, batchSize) {
    let position = 0;
    let results = [];
    while (position < items.length) {

        console.log(`Processing from position ${position} to ${batchSize}`)
        const itemsForBatch = items.slice(position, position + batchSize);
        currentSleepTimeMs = 0;
        results = [...results, ...await runWithTimeout(itemsForBatch.map(item => task(item)), 2000)];


        position += batchSize;
        // await sleep(1000); // Sleep for 5000 milliseconds (5 seconds)
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


function analyzeJson(filename) {
    let json1 = JSON.parse(fs.readFileSync(`src/data/arbitrum/ltip/${filename}.json`))

    let collectedAvax = 0;
    Object.entries(json1).forEach(
        ([k,v]) => {
            collectedAvax += json1[k];
        }
    )
    console.log('collected Avax in this JSON: ', collectedAvax)

}

function checkNegativeAccounts() {
    let json = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_2_diff.json'))
    let doublefunded = JSON.parse(fs.readFileSync('src/data/avalanche/double-funded.json')).list

    let negative = 0;
    let negativeOnes = 0;
    for (let wallet of doublefunded) {
        console.log(`${wallet}: ${json[wallet]}`)
        if (json[wallet] < 0) {
            negativeOnes++;
            negative += json[wallet];
        }
    }

    console.log(`negative accounts: ${negativeOnes}`)
    console.log(`negative amount: ${negative}`)


}

async function checkCollectedInTimestamp(timestamp) {
    let res = (await (await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/arbitrum-grant')).json()).list;
    res = res.filter(el => el.timestamp === timestamp);
    let sum = res.map(el => el.arbCollected).reduce((a,b) => a + b, 0);
    console.log(`Number of loans: ${res.length}. Total ARB collected in ${timestamp}: ${sum}`)
}

async function checkCollected() {
    let res = (await (await fetch('https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/arbitrum-grant-list')).json()).list;
    let sum = res.map(el => el.arbCollected).reduce((a,b) => a + b, 0);
    console.log(`Number of loans: ${res.length}. Total ARB collected in: ${sum}`)
}

function createAddJson(files, output) {
    let outputJson = {};

    let collectedArb = 0;

    files.forEach(
        file => {
            let json = JSON.parse(fs.readFileSync(`src/data/arbitrum/ltip/${file}.json`));

            Object.entries(json).forEach(
                ([k,v]) => {
                    outputJson[k] = (json[k] ? json[k] : 0) + (outputJson[k] ? outputJson[k] : 0)
                    collectedArb += outputJson[k];
                }
            )
        }
    )

    fs.writeFileSync(`src/data/arbitrum/ltip/${output}.json`, JSON.stringify(outputJson))

    console.log('distributed ARB in in these jsons: ', collectedArb)

}


//last distribution timestamp: 1721643728
//current distribution timestamp: 1722247318
// fetchData("LTIP_EPOCH_8", 1721643728, 1722247318, 10000, false)
// fetchLoansDataInBatches("LTIP_EPOCH_8_TOTAL")
//no need to use this one for pools
// fetchPoolsDataInBatches("LTIP_EPOCH_7", ["LTIP_SAVINGS_EPOCH_1", "LTIP_EPOCH_2_SAVINGS", "LTIP_EPOCH_3_SAVINGS", "LTIP_EPOCH_4_SAVINGS", "LTIP_EPOCH_5_SAVINGS", "LTIP_EPOCH_6_SAVINGS"])
// fetchData("LTIP_EPOCH_5_TOTAL_4", 1720013265, 1720521317, 10000, false)
// fetchData("LTIP_EPOCH-test", 1719234231, 1720013265, 10000, true)
// checkNegativeAccounts()
// checkCollectedInTimestamp(1715152203)
// checkCollected();
// createDiffJson( "LTIP_EPOCH_6_TOTAL", "LTIP_EPOCH_8_TOTAL", "arbitrum/ltip")
// createAddJson( ["LTIP_SAVINGS_EPOCH_1", "LTIP_EPOCH_2_SAVINGS", "LTIP_EPOCH_3_SAVINGS", "LTIP_EPOCH_4_SAVINGS", "LTIP_EPOCH_5_SAVINGS"], "LTIP_EPOCH_5_SAVINGS_TOTAL")
analyzeJson("LTIP_EPOCH_8_TOTAL_diff")