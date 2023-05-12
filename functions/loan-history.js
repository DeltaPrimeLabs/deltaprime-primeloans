const EthDater = require('ethereum-block-by-date');
const fs = require("fs");

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRPC = config.jsonRpc;

const Web3 = require('web3');
const web = new Web3(new Web3.providers.HttpProvider(jsonRPC));

const ARTIFACT = require(`./SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const { WrapperBuilder } = require("@redstone-finance/evm-connector");
const { SignedDataPackage } = require("redstone-protocol");
const fromWei = val => parseFloat(ethers.utils.formatEther(val));

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);


let wallet = mnemonicWallet.connect(provider);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


async function getData(loanAddress, timestamp) {
  try {
    console.log('loanAddress: ', loanAddress)

    const dater = new EthDater(web);

    let blockData = await dater.getDate(timestamp);

    let block = await provider.getBlock(blockData.block);

    let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);

    const feedsFile = fs.readFileSync('feeds.json', 'utf-8');

    let json = JSON.parse(feedsFile);

    const feeds = json[timestamp];

    console.log(feeds)

    let packages = [];


    for (let obj of feeds) {

      let txId = obj.node.id;
      let url = `https://arweave.net/${txId}`;

      const response = await fetch(url);

      const json = await response.json();

      const dataPackage = SignedDataPackage.fromObj(json)

      packages.push(dataPackage);
    }

    const wrappedContract =
        WrapperBuilder.wrap(loan).usingDataPackages(packages);

    const tx = await wrappedContract.populateTransaction.getFullLoanStatus()

    let res = await loan.signer.call(tx, block.timestamp)

    const decoded = loan.interface.decodeFunctionResult(
        'getFullLoanStatus',
        res
    );

    const status = {
      totalValue: fromWei(decoded[0][0]),
      borrowed: fromWei(decoded[0][1]),
      twv: fromWei(decoded[0][2]),
      health: fromWei(decoded[0][3]),
      solvent: fromWei(decoded[0][4]),
    };

    console.log(status);
    return status;
  } catch (e) {
    console.log(e)
    const file = fs.readFileSync("./failed-loans.json", "utf-8");
    let data = JSON.parse(file);

    if (!data.failed[loanAddress]) data.failed[loanAddress] = [];

    data.failed[loanAddress].push(timestamp);
    data.failed[loanAddress] = [...new Set(data.failed[loanAddress])]; //removing duplicates

    data = JSON.stringify(data);

    fs.writeFileSync("./failed-loans.json", data);
  }
}

async function tryFetch(func, args) {
  try {
    return await func(...args);
  } catch (e) {
    console.log(e)
    console.log('error, trying again')

    await tryFetch();
  }
}

module.exports = {
  getLoanStatusAtTimestamp: getData
}