const AWS = require('aws-sdk');
const fs = require('fs');
const ethers = require('ethers');

const {
  fetchPools,
  fetchTransfersForPool,
  fetchAllDepositors
} = require('./utils/graphql');
const { formatUnits, getHistoricalTokenPrice, getSymbolFromPoolAddress } = require('./utils/helpers');

// AWS.config.update({region:'us-east-1'});
AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const tvlThreshold = 4000000;

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRpc = config.jsonRpcAva;
const provider = new ethers.providers.JsonRpcProvider(jsonRpc);

const networkConfig = {
  tokenManagerAddress: '0xF3978209B7cfF2b90100C6F87CEC77dE928Ed58e',
  provider: provider,
  database: process.env.SPRIME_AVA_TABLE,
  poolsUnlocked: true
};
const tokenManagerAbi = [
  'function getAllPoolAssets() public view returns (bytes32[])',
  'function getPoolAddress(bytes32) public view returns (address)'
];
const network = 'avalanche';

const getLatestSprimes = async () => {
  const params = {
    TableName: networkConfig.database,
  };

  const res = await dynamoDb.scan(params).promise();

  return res.Items;
};

const sPrimeCalculator = async (event) => {
  const tokenManagerContract = new ethers.Contract(
    networkConfig.tokenManagerAddress,
    tokenManagerAbi,
    networkConfig.provider
  );
  const poolAssets = await tokenManagerContract.getAllPoolAssets();
  const poolAddresses = [];

  await Promise.all(
    poolAssets.map(async (asset) => {
      poolAddresses.push((await tokenManagerContract.getPoolAddress(asset)).toLowerCase());
    })
  )

  const [pools, depositors, sPrimeValueArray] = await Promise.all([
    fetchPools(network),
    fetchAllDepositors(network),
    getLatestSprimes()
  ]);

  const availablePools = pools.filter(pool => poolAddresses.indexOf(pool.id.toLowerCase()) !== -1);
  let sPrimeValue = {};
  let totalTime = 0;

  sPrimeValueArray.map((sPrime) => {
    sPrimeValue[sPrime.id] = {};
    for (const [key, value] of Object.entries(sPrime)) {
      if (key != 'id') sPrimeValue[sPrime.id][key] = value;
    }
  })

  if (sPrimeValueArray.length == 0) {
    sPrimeValue = JSON.parse(fs.readFileSync('sPrimeValue.json', 'utf-8'));
  }

  await Promise.all(
    availablePools.map(async (pool) => {
      const tokenSymbol = getSymbolFromPoolAddress(network, pool.id);
      let startPage = 0;

      if (sPrimeValueArray.length > 0 && sPrimeValueArray[0][tokenSymbol] && sPrimeValueArray[0][tokenSymbol].startPage) {
        startPage = sPrimeValueArray[0][tokenSymbol].startPage;
      }

      const poolTransfers = await fetchTransfersForPool(network, pool.id, startPage);
      const poolAbi = ['function decimals() public view returns(uint8)'];
      const poolContract = new ethers.Contract(pool.id, poolAbi, networkConfig.provider);
      const decimals = await poolContract.decimals();

      //add last mock transfer (for the current timestamp)
      // if (poolTransfers.length > 0) {
      //   let currentMockTransfer = {
      //     curPoolTvl: poolTransfers.length > 0 ? poolTransfers[poolTransfers.length - 1].curPoolTvl : 0,
      //     timestamp: Math.floor(Date.now() / 1000),
      //     tokenSymbol: poolTransfers[poolTransfers.length - 1].tokenSymbol,
      //     depositor: { id: 'mock' }
      //   }

      //   poolTransfers.push(currentMockTransfer);
      // }

      for (let i = 0; i < poolTransfers.length; i++) {
        const transfer = poolTransfers[i];

        const tokenPrice = await getHistoricalTokenPrice(transfer.tokenSymbol, transfer.timestamp)

        const prevTvlInUsd = i > 0 ? tokenPrice * formatUnits(poolTransfers[i - 1].curPoolTvl, Number(decimals)) : 0;

        // pool APR for previous timestamp
        let prevApr;

        if (!networkConfig.poolsUnlocked && transfer.timestamp > 1695124800) { // after 19th Sep, 2pm CEST
          let openPools = transfer.timestamp > 1695484800 ? 3 : 2;
          prevApr = 1000 * 365 / openPools / (tokenPrice * transfer.curPoolTvl / 10 ** Number(decimals));
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

        const timeInterval = i > 0 ? transfer.timestamp - poolTransfers[i - 1].timestamp : 0;
        totalTime += timeInterval;

        // update sPRIME values for all depositors
        depositors.forEach(
          depositor => {
            if (!sPrimeValue[depositor.id]) {
              sPrimeValue[depositor.id] = {};
            }

            if (!sPrimeValue[depositor.id][transfer.tokenSymbol]) {
              sPrimeValue[depositor.id][transfer.tokenSymbol] = {
                sPrime: 0,
                total: 0
              };
            }

            const userDepositInUsd = tokenPrice * sPrimeValue[depositor.id][transfer.tokenSymbol].total;

            if (transfer.timestamp > 1693756800) {
              const newValue = (timeInterval < 0 ? 0 : timeInterval) / 31536000 * (prevApr * userDepositInUsd);
              sPrimeValue[depositor.id][transfer.tokenSymbol].sPrime = Number(sPrimeValue[depositor.id][transfer.tokenSymbol].sPrime) + newValue;
            }
            sPrimeValue[depositor.id][transfer.tokenSymbol]['timestamp'] = transfer.timestamp;
            sPrimeValue[depositor.id][transfer.tokenSymbol]['startPage'] = startPage + 1;
          }
        );

        if (transfer.depositor.id !== 'mock') {
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total = Number(sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total) +
                                                                            Number(formatUnits(transfer.amount, Number(decimals)));
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total = Math.max(sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total, 0);
        }
      };
    })
  );

  console.log(`${Object.entries(sPrimeValue).length} depositors updated.`);
  // save/update sPRIME values to DB
  await Promise.all(
    Object.entries(sPrimeValue).map(async ([userId, values]) => {
      const data = {
        id: userId,
        ...values
      };
      // console.log(data);

      const userInfo = {
        TableName: networkConfig.database,
        Item: data
      };
      await dynamoDb.put(userInfo).promise();
    })
  );

  console.log("sPRIME values successfully updated.")

  return event;
};

module.exports.handler = sPrimeCalculator;
// sPrimeCalculator();
