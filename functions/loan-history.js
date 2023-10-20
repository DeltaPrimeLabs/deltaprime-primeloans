const EthDater = require('ethereum-block-by-date');
const fs = require("fs");

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRPC = config.jsonRpc;

const Web3 = require('web3');
const web = new Web3(new Web3.providers.HttpProvider(jsonRPC));

const {queryHistoricalFeeds} = require("./query-arweave");
const ARTIFACT = require(`./SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const { WrapperBuilder } = require("@redstone-finance/evm-connector");
const { SignedDataPackage } = require("redstone-protocol");
const fromWei = val => parseFloat(ethers.utils.formatEther(val));

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


let wallet = mnemonicWallet.connect(provider);


const fetchHistoricalPrices = async (timestamp) => {
  const file = fs.readFileSync('timestamps.json', 'utf-8');
  let timestampsData = JSON.parse(file);

  const feedsFile = fs.readFileSync('feeds.json', 'utf-8');
  let json = JSON.parse(feedsFile);

  const nodeAddress1 = '0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747';
  const nodeAddress2 = '0x2c59617248994D12816EE1Fa77CE0a64eEB456BF';
  const nodeAddress3 = '0x12470f7aBA85c8b81D63137DD5925D6EE114952b';

  const timestamps = timestampsData.timestamps;

  for (let timestamp of timestamps) {
    if (json[timestamp.length > 0]) continue;

    json[timestamp] = [];

    const dater = new EthDater(web);

    let blockData = await dater.getDate(timestamp);

    let block = await provider.getBlock(blockData.block);

    let approxTimestamp = parseInt((block.timestamp / 10).toString()) * 10; //requirement for Redstone

    const feeds = await queryHistoricalFeeds(approxTimestamp, [nodeAddress1, nodeAddress2, nodeAddress3]);

    for (let obj of feeds) {

      let txId = obj.node.id;
      let url = `https://arweave.net/${txId}`;

      const response = await fetch(url);

      json[timestamp].push(await response.json());
    }
  }

  console.log(json)
  fs.writeFileSync('feeds.json', JSON.stringify(json));

  // return json;
}

async function getData(loanAddress, timestamp) {
  try {
    // console.log('loanAddress: ', loanAddress)

    const dater = new EthDater(web);

    let blockData = await dater.getDate(timestamp);

    let block = await provider.getBlock(blockData.block);

    let loan = new ethers.Contract(loanAddress, ARTIFACT.abi, wallet);

    const feedsFile = fs.readFileSync('feeds.json', 'utf-8');

    let json = JSON.parse(feedsFile);
    // const json = await fetchHistoricalPrices(timestamp);

    if (json[timestamp].length == 0) return;

    const feeds = json[timestamp].map(feed => SignedDataPackage.fromObj(feed));

    const wrappedContract =
        WrapperBuilder.wrap(loan).usingDataPackages(feeds);

    const tx = await wrappedContract.populateTransaction.getFullLoanStatus()

    let res = await loan.signer.call(tx, block.number)

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

    return status;
  } catch (e) {
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
