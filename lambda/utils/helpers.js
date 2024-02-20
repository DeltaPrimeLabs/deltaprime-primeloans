const AWS = require('aws-sdk');
const ethers = require('ethers');
const redstone = require('redstone-api');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const EthDater = require("ethereum-block-by-date");

const networkInfo = require('./constants.json');
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');

const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
// const { queryHistoricalFeeds } = require("./query-arweave");
// const fetch = require("node-fetch");
// const { SignedDataPackage } = require("redstone-protocol");
// const Web3 = require('web3');
// const web = new Web3(new Web3.providers.HttpProvider('https://avax.nirvanalabs.xyz/avalanche_ui/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771'));


// AWS DynamoDB setup
AWS.config.update({ region: 'us-east-1' });
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// String -> BigNumber
const parseUnits = ethers.utils.parseUnits;
// BigNumber -> String
const formatUnits = ethers.utils.formatUnits;
const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const toWei = val => ethers.utils.parseEther(val.toString());

const avalancheProvider = new ethers.providers.JsonRpcProvider('https://nd-033-589-713.p2pify.com/d41fdf9956747a40bae4edec06ad4ab9/ext/bc/C/rpc');
const arbitrumProvider = new ethers.providers.JsonRpcProvider(process.env.FUNC_RPC_ARB);

const avalancheHistoricalProvider = new ethers.providers.JsonRpcProvider('https://nd-033-589-713.p2pify.com/d41fdf9956747a40bae4edec06ad4ab9/ext/bc/C/rpc');
const arbitrumHistoricalProvider = new ethers.providers.JsonRpcProvider(process.env.EXT_RPC_ARB);

const avalancheWallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(avalancheProvider);
const arbitrumWallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(arbitrumProvider);

const getHistoricalTokenPrice = async (token, timestamp) => {
  let depth = 0;
  while (1) {
    let resp = await redstone.getHistoricalPrice([token], {
      date: new Date((Number(timestamp) + depth * 600) * 1000).toISOString(),
    });

    if (token in resp && 'value' in resp[token]) return resp[token].value;
    depth++;
  }
}

const getSymbolFromPoolAddress = (network, address) => {
  return networkInfo[network].pools[address];
}


const wrap = (contract, network) => {
  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: `redstone-${network}-prod`,
      uniqueSignersCount: 3,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
}
const wrapWithPackages = (contract, network, packages) => {
  return WrapperBuilder.wrap(contract).usingDataPackages(packages);
}

const getWrappedContracts = (addresses, network) => {
  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? avalancheWallet : arbitrumWallet);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

const getWrappedContractsHistorical = (addresses, network, packages) => {
  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? avalancheWallet : arbitrumWallet);
    const wrappedContract = wrapWithPackages(loanContract, network, packages);

    return wrappedContract;
  });
}

// this is being used in retroactiveCalculator in ec2 - uncomment it when you run it on ec2
// async function getArweavePackages(timestamp) {
//   const nodeAddress1 = '0x83cbA8c619fb629b81A65C2e67fE15cf3E3C9747';
//   const nodeAddress2 = '0x2c59617248994D12816EE1Fa77CE0a64eEB456BF';
//   const nodeAddress3 = '0x12470f7aBA85c8b81D63137DD5925D6EE114952b';
//   //do dziesietnych

//   const dater = new EthDater(web);

//   let blockData = await dater.getDate(timestamp * 1000);

//   let approxTimestamp = parseInt((blockData.timestamp / 10).toString()) * 10; //requirement for Redstone

//   const feeds = await queryHistoricalFeeds(approxTimestamp, [nodeAddress1, nodeAddress2, nodeAddress3]);

//   let packages = [];


//   for (let obj of feeds) {

//     let txId = obj.node.id;
//     let url = `https://arweave.net/${txId}`;

//     const response = await fetch(url);

//     const json = await response.json();

//     const dataPackage = SignedDataPackage.fromObj(json)

//     packages.push(dataPackage);
//   }

//   return packages;
// }

const fromBytes32 = ethers.utils.parseBytes32String;
const toBytes32 = ethers.utils.formatBytes32String;

const getBlockForTimestamp = async (network, timestamp) => {
  let provider = new ethers.providers.JsonRpcProvider(network == "avalanche" ? process.env.EXT_RPC_AVA : process.env.EXT_RPC_ARB);
  const dater = new EthDater(
    provider // ethers provider, required.
  );

  return await dater.getDate(
    timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  );
}

module.exports = {
  parseUnits,
  formatUnits,
  fromWei,
  toWei,
  fromBytes32,
  toBytes32,
  getHistoricalTokenPrice,
  getSymbolFromPoolAddress,
  wrap,
  avalancheProvider,
  arbitrumProvider,
  avalancheHistoricalProvider,
  arbitrumHistoricalProvider,
  avalancheWallet,
  arbitrumWallet,
  dynamoDb,
  getWrappedContracts,
  getWrappedContractsHistorical,
  getBlockForTimestamp,
  getArweavePackages
}