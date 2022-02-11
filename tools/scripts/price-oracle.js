const config = require('../network/config-fuji.json');
const fs = require('fs');
const ethers = require('ethers');
const PRICE_PROVIDER = require('../../build/contracts/SimplePriceProvider.json');

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

async function setPrice(asset, price) {
  console.log("Oracle address: " + wallet.address);
  console.log(`Setting price of ${asset} to: ${price}`);
  let priceProvider = new ethers.Contract(PRICE_PROVIDER.networks[config["network-id"]].address, PRICE_PROVIDER.abi, wallet);
  let tx = await priceProvider.setPrice(ethers.utils.formatBytes32String(asset), toWei(price.toString()));
  console.log("Waiting for tx: " + tx.hash);
  let receipt = await provider.waitForTransaction(tx.hash);
  console.log("Setting price processed with " + (receipt.status == 1 ? "success" : "failure"));
}


module.exports = {
  setPrice
};
