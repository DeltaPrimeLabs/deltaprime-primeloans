const AWS = require('aws-sdk');
const fetch = require('node-fetch');
const fs = require('fs');
const ethers = require('ethers');
const redstone = require('redstone-api');
const fromBytes32 = ethers.utils.parseBytes32String;

const {
  fetchPools,
  fetchTransfersForPool
} = require('./utils/graphql');
const { formatUnits } = require('./utils/helpers');

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const tvlThreshold = 4000000;

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRpcArb = config.jsonRpcArb;
const providerArb = new ethers.providers.JsonRpcProvider(jsonRpcArb);

const tokenManagerAbi = [
    'function getAllPoolAssets() public view returns (bytes32[])',
    'function getPoolAddress(bytes32) public view returns (address)'
];
const tokenManagerAddress = '0x0a0d954d4b0f0b47a5990c0abd179a90ff74e255';
const tokenManagerContract = new ethers.Contract(tokenManagerAddress, tokenManagerAbi, providerArb);

const sPrimeCalculator = async (event) => {
  const poolAssets = await tokenManagerContract.getAllPoolAssets();
  const poolContracts = [];

  for (let asset of poolAssets) {
    poolContracts.push((await tokenManagerContract.getPoolAddress(asset)).toLowerCase());
  }

  let pools = (await fetchPools()).filter(pool => poolContracts.indexOf(pool.id.toLowerCase()) !== -1);

  const sPrimeValue = {};

  let totalTime = 0;

  await Promise.all(
    pools.map(async (pool) => {
      const poolTransfers = await fetchTransfersForPool(pool.id);

      //add last mock transfer (for the current timestamp)
      if (poolTransfers.length > 0) {
        let currentMockTransfer = {
          curPoolTvl: poolTransfers.length > 0 ? poolTransfers[poolTransfers.length - 1].curPoolTvl : 0,
          timestamp: Math.floor(Date.now() / 1000),
          tokenSymbol: poolTransfers[poolTransfers.length - 1].tokenSymbol,
          depositor: { id: 'mock' }
        }

        poolTransfers.push(currentMockTransfer);
      }

      for (let i = 0; i < poolTransfers.length; i++) {
        const transfer = poolTransfers[i];

        let resp = await redstone.getHistoricalPrice([transfer.tokenSymbol], {
          date: transfer.timestamp * 1000,
        });

        const tokenPrice = resp[transfer.tokenSymbol].value;

        const prevTvlInUsd = i > 0 ? tokenPrice * formatUnits(poolTransfers[i - 1].curPoolTvl, Number(pool.decimals)) : 0;

        // pool APR for previous timestamp
        let prevApr;

        if (transfer.timestamp > 1695124800) { // after 19th Sep, 2pm CEST
          prevApr = 1000 * 365 / poolAssets.length / (tokenPrice * transfer.curPoolTvl / 10 ** Number(pool.decimals));
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

        const timeInterval = transfer.timestamp - (i > 0 ? poolTransfers[i - 1].timestamp : 1693756800);
        totalTime += timeInterval;

        Object.keys(sPrimeValue).forEach(
          depositor => {
            if (!sPrimeValue[depositor][transfer.tokenSymbol]) {
              sPrimeValue[depositor][transfer.tokenSymbol] = {
                sPrime: 0,
                total: 0
              };
            }

            const userDepositInUsd = tokenPrice * sPrimeValue[depositor][transfer.tokenSymbol].total;
            const newValue = (timeInterval < 0 ? 0 : timeInterval) / 31536000 * (prevApr * userDepositInUsd);

            sPrimeValue[depositor][transfer.tokenSymbol].sPrime += newValue;
          }
        );

        if (transfer.depositor.id !== 'mock') {
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total += Number(formatUnits(transfer.amount, Number(pool.decimals)));
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total = Math.max(sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total, 0);
        }
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
