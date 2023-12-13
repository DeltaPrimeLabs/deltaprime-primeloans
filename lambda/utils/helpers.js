const AWS = require('aws-sdk');
const ethers = require('ethers');
const redstone = require('redstone-api');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;

const networkInfo = require('./constants.json');
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');

const config = require('../rpcConfig.json');
const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);

// AWS DynamoDB setup
AWS.config.update({region:'us-east-1'});
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// String -> BigNumber
const parseUnits = ethers.utils.parseUnits;
// BigNumber -> String
const formatUnits = ethers.utils.formatUnits;
const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const toWei = val => ethers.utils.parseEther(val.toString());

const jsonRpcAva = config.jsonRpcAva;
const jsonRpcArb = config.jsonRpcArb;
const avalancheProvider = new ethers.providers.JsonRpcProvider(jsonRpcAva);
const arbitrumProvider = new ethers.providers.JsonRpcProvider(jsonRpcArb);

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

const getWrappedContracts = (addresses, network) => {
  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? avalancheWallet : arbitrumWallet);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

const fromBytes32 = ethers.utils.parseBytes32String;
const toBytes32 = ethers.utils.formatBytes32String;

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
  dynamoDb,
  getWrappedContracts
}