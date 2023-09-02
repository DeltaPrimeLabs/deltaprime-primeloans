const contractName = "contract_name";
const contractAddress = "contract_address";
const contractMethod = "method_name";
const jsonRPC = "https_address";

const ARTIFACT = require(`../../artifacts/contracts/${contractName}.sol/${contractName}.json`);
const ethers = require("ethers");
const fs = require("fs");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let contract = new ethers.Contract(contractAddress, ARTIFACT.abi, wallet);

contract[contractMethod]().then(
    res => {
        console.log(res);
    }
)

