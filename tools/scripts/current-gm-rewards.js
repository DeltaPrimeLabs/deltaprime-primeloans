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
async function run() {
    let loans = await factory.getAllLoans();

    let resps = await Promise.all(loans.map(loan => fetch(`https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gmx-incentives/${loan}?network=arbitrum`)))
    let jsons = await Promise.all(resps.map(json => json.json()))

    console.log(jsons)

    let json = {};
    jsons.forEach(j => {
        json[j.id] = j.arbCollected
    })

    fs.writeFileSync('src/data/arbitrum/GM_EPOCH_8.json', JSON.stringify(json))

    let collectedArb = 0;

   let json1 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_1.json'))
   let json2 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_2.json'))
   let json3 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_3.json'))
   let json4 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_4.json'))
   let json5 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_5.json'))
   let json6 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_6.json'))
   let json7 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_7.json'))
   let json8 = JSON.parse(fs.readFileSync('src/data/arbitrum/GM_EPOCH_8.json'))

    let json9 = {};

    Object.entries(json8).forEach(
        ([k,v]) => {
            json9[k] = json8[k] - (json7[k] ? json7[k] : 0)
            collectedArb += json9[k];
        }
    )



    fs.writeFileSync('src/data/arbitrum/GM_EPOCH_8_only_this_epoch.json', JSON.stringify(json9))

    console.log('collectedArb in this epoch: ', collectedArb)
}

run().then()