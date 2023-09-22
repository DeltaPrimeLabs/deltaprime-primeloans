const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const fs = require('fs');
const ethers = require('ethers');

const {
  fetchPools,
  fetchTransfersForPool
} = require('./utils/graphql');
const { formatUnits } = require('./utils/helpers');

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const redstoneFeedUrl = 'https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod';
const tvlThreshold = 4000000;

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRpcArb = config.jsonRpcArb;
const providerArb = new ethers.providers.JsonRpcProvider(jsonRpcArb);

const tokenManagerAbi = ['function getAllPoolAssets() public view returns (bytes32[])'];
const tokenManagerAddress = '0x0a0d954d4b0f0b47a5990c0abd179a90ff74e255';
const tokenManagerContract = new ethers.Contract(tokenManagerAddress, tokenManagerAbi, providerArb);

const sPrimeCalculator = async (event) => {
  const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
  const redstonePriceData = await redstonePriceDataRequest.json();
  const poolAssets = await tokenManagerContract.getAllPoolAssets();

  const pools = await fetchPools();
  const sPrimeValue = {};

  await Promise.all(
    pools.map(async (pool) => {
      const poolTransfers = await fetchTransfersForPool(pool.id);

      for (let i = 0; i < poolTransfers.length; i++) {
        const transfer = poolTransfers[i];
        const tokenPrice = redstonePriceData[transfer.tokenSymbol][0].dataPoints[0].value;
        const prevTvlInUsd = i > 0 ? tokenPrice * formatUnits(poolTransfers[i - 1].curPoolTvl, Number(pool.decimals)) : 0;

        // pool APR for previous timestamp
        let prevApr;

        if (transfer.timestamp > 1695211200) { // after 20th Sep, 2pm CEST
          prevApr = 1000 * 365 / poolAssets.length / (tokenPrice * transfer.curPoolTvl);
        } else {
          prevApr = Math.max((1 - prevTvlInUsd / tvlThreshold) * 0.1, 0);
        }

        if (!sPrimeValue[transfer.depositor.id]) {
          sPrimeValue[transfer.depositor.id] = {};
        }

        // initialize sPRIME value of depositor for the pool
        if (!sPrimeValue[transfer.depositor.id][transfer.tokenSymbol]) {
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol] = {
            sPrime: 0,
            total: 0
          };
        }

        sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total += Number(formatUnits(transfer.amount, Number(pool.decimals)));
        const userDepositInUsd = tokenPrice * sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total;
        const timeInterval = transfer.timestamp - (i > 0 ? poolTransfers[i - 1].timestamp : 1693756800);
        const newValue = (timeInterval < 0 ? 0 : timeInterval) / 31536000 * (100 * prevApr * userDepositInUsd);
        if (transfer.depositor.id == "0x12b26dd6a01d0de420ba2ef485e4152c9b16d603") {
          console.log(100 * prevApr, userDepositInUsd, timeInterval, newValue);
        }

        sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].sPrime += newValue;
      };
    })
  );

  // save/update sPRIME values to DB
  // for (const [userId, values] of Object.entries(sPrimeValue)) {
  //   const data = {
  //     id: userId,
  //     ...values
  //   };

  //   const userInfo = {
  //     TableName: process.env.SPRIME_TABLE,
  //     Item: data
  //   };
  //   dynamoDb.put(userInfo).promise()
  //     .then(res => data);
  // }

  // console.log("sPRIME values successfully updated.")

  // return event;
};

// module.exports.handler = sPrimeCalculator;
sPrimeCalculator();
