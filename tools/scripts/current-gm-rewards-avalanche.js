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
async function run() {
    let loans = await factory.getAllLoans();

    let resps = await Promise.all(loans.map(loan => fetch(`https://cavsise1n4.execute-api.us-east-1.amazonaws.com/gmx-incentives-retroactive/${loan}`)))
    let jsons = await Promise.all(resps.map(json => json.json()))

    console.log(jsons)

    let json = {};
    jsons.forEach((j, i) => {
        json[loans[i]] = j.total
    })

    fs.writeFileSync('src/data/avalanche/GM_EPOCH_1.json', JSON.stringify(json))

    let collectedAvax = 0;

   let json1 = JSON.parse(fs.readFileSync('src/data/avalanche/GM_EPOCH_1.json'))

    // let json9 = {};
    //
    // Object.entries(json8).forEach(
    //     ([k,v]) => {
    //         json9[k] = json8[k] - (json7[k] ? json7[k] : 0)
    //         collectedAvax += json9[k];
    //     }
    // )

    console.log(json1)

    Object.entries(json1).forEach(
        ([k,v]) => {
            console.log(json1[k])
            collectedAvax += json1[k];
        }
    )



    fs.writeFileSync('src/data/avalanche/GM_EPOCH_1.json', JSON.stringify(json1))

    console.log('collected Avax in this epoch: ', collectedAvax)
}

run().then()