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

    fs.writeFileSync(`src/data/${location}/${file2}_diff.json`, JSON.stringify(json2))

    console.log('distributed Avax in this epoch: ', collectedAvax)

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


//last distribution timestamp: 1719234231
//current distribution timestamp: 1720013265
// fetchData("LTIP_EPOCH-test", 1719234231, Math.ceil(Date.now()/1000), 10000, true)
// fetchData("LTIP_EPOCH-test", 1719234231, 1720013265, 10000, true)
// checkNegativeAccounts()
// checkCollectedInTimestamp(1715152203)
// checkCollected();
// createDiffJson( "LTIP_EPOCH_3", "LTIP_EPOCH_4", "arbitrum/ltip")
// createAddJson( "GM_EPOCH_8", "GM_EPOCH_9_diff", "GM_EPOCH_9")
// analyzeJson("LTIP_EPOCH_4")