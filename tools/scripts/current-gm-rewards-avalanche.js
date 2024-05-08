const jsonRPC = "https://avalanche-mainnet.core.chainstack.com/ext/bc/C/rpc/0968db18a01a90bac990ff00df6f7da1";
const fetch = require("node-fetch");

const FACTORY_ARTIFACT = require(`../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json`);
const fs = require("fs");
const ethers = require("ethers");
const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let factory = new ethers.Contract('0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D', FACTORY_ARTIFACT.abi, wallet);


let collectedTotal = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Timeout function that rejects after a specified time
function timeout(ms) {
    return new Promise((resolve, reject) => setTimeout(() => reject(new Error('Timeout')), ms));
}

let currentSleepTimeMs = 0;

// Function to perform your async operations with retry on timeout
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

async function fetchData(maxTimestamp, file) {
    let loans = await factory.getAllLoans();

    const task = (loan) => fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gmx-incentives-new/${loan}`)

    console.log(`LONS: ${loans.length}`)
    loans = loans.slice(3600, 4000);

    let resps = await promiseAllInBatches(task, loans, 100);


    let jsons = await Promise.all(resps.map(json => json.json()))

    console.log(jsons)

    let json = {};
    try {
        json = JSON.parse(fs.readFileSync(`src/data/avalanche/${file}.json`));
    } catch (e) {
        console.log('No file')
    }

    jsons.forEach((j, i) => {
        json[loans[i]] = j.list.filter(el => el.timestamp <= maxTimestamp).reduce((sum, el) => sum + el.avaxCollected, 0)
    })

    fs.writeFileSync(`src/data/avalanche/${file}.json`, JSON.stringify(json))

    let collectedAvax = 0;

    let json1 = JSON.parse(fs.readFileSync(`src/data/avalanche/${file}.json`))


    Object.entries(json1).forEach(
        ([k,v]) => {
            collectedAvax += json1[k];
        }
    )

    console.log('collected Avax: ', collectedAvax)
}

// run().then()


function includeDoubleFunded() {
    let json = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_1.json'))
    let doublefunded = JSON.parse(fs.readFileSync('src/data/avalanche/double-funded.json')).list

    let excessiveAmount = 0;
    for (let wallet of doublefunded) {
        excessiveAmount += json[wallet];
        json[wallet] = 2 * json[wallet];
    }

    let distributedAvax = 0;

    Object.entries(json).forEach(
        ([k,v]) => {
            distributedAvax += json[k];
        }
    );

    fs.writeFileSync('src/data/avalanche/GM_EPOCH_1_fixed.json', JSON.stringify(json))

    console.log('distributed Avax in this epoch: ', distributedAvax)
    console.log('excessive amount: ', excessiveAmount)


}

function createDiffJson(file1, file2) {
    let json0 = JSON.parse(fs.readFileSync(`src/data/avalanche/${file1}.json`))
    let json1 = JSON.parse(fs.readFileSync(`src/data/avalanche/${file2}.json`))
    let json2 = {};

    let collectedAvax = 0;
    Object.entries(json1).forEach(
        ([k,v]) => {
            json2[k] = json1[k] - (json0[k] ? json0[k] : 0)
            collectedAvax += json2[k];
        }
    )

    fs.writeFileSync(`src/data/avalanche/${file2}_diff.json`, JSON.stringify(json2))

    console.log('distributed Avax in this epoch: ', collectedAvax)

}

function createAddJson(file1, file2, file3) {
    let json0 = JSON.parse(fs.readFileSync(`src/data/avalanche/${file1}.json`))
    let json1 = JSON.parse(fs.readFileSync(`src/data/avalanche/${file2}.json`))
    let json2 = {};

    let collectedAvax = 0;
    Object.entries(json1).forEach(
        ([k,v]) => {
            json2[k] = (json1[k] ? json1[k] : 0) + (json0[k] ? json0[k] : 0)
            collectedAvax += json2[k];
        }
    )

    fs.writeFileSync(`src/data/avalanche/${file3}.json`, JSON.stringify(json2))

    console.log('distributed Avax in this epoch: ', collectedAvax)

}

function analyzeJson(filename) {
    let json1 = JSON.parse(fs.readFileSync(`src/data/avalanche/${filename}.json`))

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

// fetchData(Date.now(), "GM_EPOCH_13")
// checkNegativeAccounts()
// checkCollectedInTimestamp(1715152203)
createDiffJson( "GM_EPOCH_11", "GM_EPOCH_12")
// createAddJson( "GM_EPOCH_8", "GM_EPOCH_9_diff", "GM_EPOCH_9")
// analyzeJson("GM_EPOCH_9")