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
        try {
            results = [...results, ...await Promise.all(itemsForBatch.map(item => task(item)))];
        } catch (e) {
            try {
                results = [...results, ...await Promise.all(itemsForBatch.map(item => task(item)))];
            } catch (e) {
                try {
                    results = [...results, ...await Promise.all(itemsForBatch.map(item => task(item)))];
                } catch (e) {
                    results = [...results, ...await Promise.all(itemsForBatch.map(item => task(item)))];
                }
            }
        }
        position += batchSize;
    }
    return results;
}

async function run() {
    let loans = await factory.getAllLoans();

    const task = (loan) => fetch(`https://2t8c1g5jra.execute-api.us-east-1.amazonaws.com/gmx-incentives-retroactive/${loan}`)

    let resps = await promiseAllInBatches(task, loans, 50);

    let jsons = await Promise.all(resps.map(json => json.json()))

    let json = {};
    jsons.forEach((j, i) => {
        if (loans[i] === '0xfd94711Ea42f74581E1B2a54aC3A52954B0A5b35') {
            console.log(j)
        }
        json[loans[i]] = j.total
    })

    fs.writeFileSync('src/data/avalanche/GM_EPOCH_1.json', JSON.stringify(json))

    let collectedAvax = 0;

   let json1 = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_1.json'))

    Object.entries(json1).forEach(
        ([k,v]) => {
            collectedAvax += json1[k];
        }
    )


    fs.writeFileSync('src/data/avalanche/GM_EPOCH_1.json', JSON.stringify(json1))

    console.log('collected Avax in this epoch: ', collectedAvax)
}

run().then()