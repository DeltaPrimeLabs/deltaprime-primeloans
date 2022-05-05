const config = require('../network/config-local.json');
const fs = require('fs');
const ethers = require('ethers');
const POOL = require('../../build/contracts/Pool.json');

const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const toWei = ethers.utils.parseEther;

const mnemonic = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic);

var provider;
if (config['provider-url'] === "localhost") {
  provider = new ethers.providers.JsonRpcProvider();
} else  {
  provider = new ethers.providers.JsonRpcProvider(config['provider-url'], "unspecified");
}

let wallet = mnemonicWallet.connect(provider);

async function depositToPool(amount) {
  console.log("Depositing to the pool: " + amount);
  let pool = new ethers.Contract(POOL.networks[config["network-id"]].address, POOL.abi, wallet);
  let tx = await pool.deposit({value: toWei(amount.toString())});
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Depositing processed with " + (receipt.status == 1 ? "success" : "failure"));
}


async function run() {
  await depositToPool(10)
}

run();
