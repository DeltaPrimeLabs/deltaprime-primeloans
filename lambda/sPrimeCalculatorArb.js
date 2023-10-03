const ethers = require('ethers');
const redstone = require('redstone-api');

const {
  fetchPools,
  fetchTransfersForPool
} = require('./utils/graphql');
const { formatUnits, arbitrumProvider, dynamoDb } = require('./utils/helpers');

const tvlThreshold = 4000000;

const networkConfig = {
  tokenManagerAddress: '0x0a0d954d4b0f0b47a5990c0abd179a90ff74e255',
  provider: arbitrumProvider,
  database: process.env.SPRIME_ARB_TABLE,
  poolsUnlocked: false
}
const tokenManagerAbi = [
  'function getAllPoolAssets() public view returns (bytes32[])',
  'function getPoolAddress(bytes32) public view returns (address)'
];
const network = 'arbitrum';

const sPrimeCalculator = async (event) => {  
  const tokenManagerContract = new ethers.Contract(
    networkConfig.tokenManagerAddress,
    tokenManagerAbi,
    networkConfig.provider
  );
  const poolAssets = await tokenManagerContract.getAllPoolAssets();
  const poolAddresses = [];

  for (let asset of poolAssets) {
    poolAddresses.push((await tokenManagerContract.getPoolAddress(asset)).toLowerCase());
  }

  let pools = (await fetchPools(network)).filter(pool => poolAddresses.indexOf(pool.id.toLowerCase()) !== -1);

  const sPrimeValue = {};

  let totalTime = 0;

  await Promise.all(
    pools.map(async (pool) => {
      const poolTransfers = await fetchTransfersForPool(network, pool.id);
      const poolAbi = ['function decimals() public view returns(uint8)'];
      const poolContract = new ethers.Contract(pool.id, poolAbi, networkConfig.provider);
      const decimals = await poolContract.decimals();

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
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total += Number(formatUnits(transfer.amount, Number(decimals)));
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total = Math.max(sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total, 0);
        }
      };
    })
  );

  // save/update sPRIME values to DB
  for (const [userId, values] of Object.entries(sPrimeValue)) {
    const data = {
      id: userId,
      ...values
    };

    const params = {
      TableName: networkConfig.database,
      Item: data
    };
    dynamoDb.put(params).promise()
      .then(res => data);
  }

  console.log("sPRIME values successfully updated.")

  return event;
};

module.exports.handler = sPrimeCalculator;
// sPrimeCalculator();
