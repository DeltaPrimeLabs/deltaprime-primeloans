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

async function promiseAllInBatches(task, items, batchSize) {
    let position = 0;
    let results = [];
    while (position < items.length) {
        const itemsForBatch = items.slice(position, position + batchSize);
        results = [...results, ...await Promise.all(itemsForBatch.map(item => task(item)))];
        position += batchSize;
    }
    return results;
}

async function fetchData(maxTimestamp) {
    let loans = await factory.getAllLoans();

    const task = (loan) => fetch(` https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gmx-incentives-remake/${loan}`)

    let resps = await promiseAllInBatches(task, loans, 50);


    let jsons = await Promise.all(resps.map(json => json.json()))

    console.log(jsons)

    let json = {};
    jsons.forEach((j, i) => {
        json[loans[i]] = j.list.filter(el => el.timestamp <= maxTimestamp).reduce((sum, el) => sum + el.avaxCollected, 0)
    })

    fs.writeFileSync('src/data/avalanche/GM_EPOCH_4.json', JSON.stringify(json))

    let collectedAvax = 0;

    let json1 = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_4.json'))

    // let json9 = {};
    //
    // Object.entries(json8).forEach(
    //     ([k,v]) => {
    //         json9[k] = json8[k] - (json7[k] ? json7[k] : 0)
    //         collectedAvax += json9[k];
    //     }
    // )

    Object.entries(json1).forEach(
        ([k,v]) => {
            collectedAvax += json1[k];
        }
    )



    fs.writeFileSync('src/data/avalanche/GM_EPOCH_4.json', JSON.stringify(json1))

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

function createDiffJson() {
    let json0 = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_3.json'))
    let json1 = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_4.json'))
    let json2 = {};

    let collectedAvax = 0;
    Object.entries(json1).forEach(
        ([k,v]) => {
            json2[k] = json1[k] - (json0[k] ? json0[k] : 0)
            collectedAvax += json2[k];
        }
    )

    fs.writeFileSync('src/data/avalanche/GM_EPOCH_4_diff.json', JSON.stringify(json2))

    console.log('distributed Avax in this epoch: ', collectedAvax)

}

function analyzeJson() {
    let json1 = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_2_diff.json'))

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
fetchData(Date.now())
// checkNegativeAccounts()
// createDiffJson()