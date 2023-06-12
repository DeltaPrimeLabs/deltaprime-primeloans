const contractName = "SmartLoansFactory";
const contractAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const contractMethod = "getAllLoans";
const jsonRPC = "https://rpc.ankr.com/avalanche";

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

