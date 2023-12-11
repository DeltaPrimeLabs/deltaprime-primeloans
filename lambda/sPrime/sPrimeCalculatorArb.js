const ethers = require('ethers');

const {
  fetchPools,
  fetchTransfersForPool,
  fetchAllDepositors
} = require('../utils/graphql');
const {
  formatUnits,
  getHistoricalTokenPrice,
  getSymbolFromPoolAddress,
  dynamoDb,
  arbitrumProvider
} = require('../utils/helpers');

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

  await Promise.all(
    availablePools.map(async (pool) => {
      const tokenSymbol = getSymbolFromPoolAddress(network, pool.id);
      let offset = 0;
      let lastTimestamp = Date.now();
      let lastPoolTvl = 0;

      if (sPrimeValueArray.length > 0 &&
          sPrimeValueArray[0][tokenSymbol] &&
          sPrimeValueArray[0][tokenSymbol].offset &&
          sPrimeValueArray[0][tokenSymbol].timestamp &&
          sPrimeValueArray[0][tokenSymbol].curPoolTvl) {
        offset = Number(sPrimeValueArray[0][tokenSymbol].offset);
        lastTimestamp = Number(sPrimeValueArray[0][tokenSymbol].timestamp);
        lastPoolTvl = sPrimeValueArray[0][tokenSymbol].curPoolTvl;
      }

      const poolTransfers = await fetchTransfersForPool(network, pool.id, offset);
      const poolTransfersLen = poolTransfers.length;
      const poolAbi = [
        'function decimals() public view returns(uint8)',
        'function totalSupply() public view returns(uint256)'
      ];
      const poolContract = new ethers.Contract(pool.id, poolAbi, networkConfig.provider);
      const decimals = await poolContract.decimals();
      const poolTvl = await poolContract.totalSupply();

      // add last mock transfer (for the current timestamp)
      if (poolTransfersLen < 100) { // should be equal to limit param in query
        let currentMockTransfer = {
          curPoolTvl: poolTvl.toString(),
          timestamp: Math.floor(Date.now() / 1000),
          tokenSymbol: tokenSymbol,
          depositor: { id: 'mock' }
        }

        poolTransfers.push(currentMockTransfer);
      }

      for (let i = 0; i < poolTransfers.length; i++) {
        const transfer = poolTransfers[i];

        const tokenPrice = await getHistoricalTokenPrice(transfer.tokenSymbol, transfer.timestamp)

        const prevTvlInUsd = tokenPrice * (i > 0
                                          ? formatUnits(poolTransfers[i - 1].curPoolTvl, Number(decimals))
                                          : offset > 0
                                            ? formatUnits(lastPoolTvl, Number(decimals))
                                            : 0);

        // pool APR for previous timestamp
        let prevApr;

        if (!networkConfig.poolsUnlocked && transfer.timestamp > 1695124800) { // after 19th Sep, 2pm CEST
          let openPools = transfer.timestamp > 1695484800 ? 3 : 2;
          prevApr = 1000 * 365 / openPools / (tokenPrice * transfer.curPoolTvl / 10 ** Number(decimals));
        } else {
          prevApr = Math.max((1 - prevTvlInUsd / tvlThreshold) * 0.1, 0);
        }

        // initialize sPRIME value of depositor for the pool
        if (!sPrimeValue[transfer.depositor.id]) {
          sPrimeValue[transfer.depositor.id] = {};
        }
        if (!sPrimeValue[transfer.depositor.id][transfer.tokenSymbol]) {
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol] = {
            sPrime: 0,
            total: 0
          };
        }

        let timeInterval = i > 0 ? transfer.timestamp - poolTransfers[i - 1].timestamp : offset > 0 ? transfer.timestamp - lastTimestamp : 0;
        if (poolTransfersLen == 0) {
          timeInterval = transfer.timestamp - lastTimestamp;
        }
        totalTime += timeInterval;

        if (transfer.depositor.id !== 'mock') {
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total = Number(sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total) +
                                                                            Number(formatUnits(transfer.amount, Number(decimals)));
          sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total = Math.max(sPrimeValue[transfer.depositor.id][transfer.tokenSymbol].total, 0);
        }

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

            const newValue = (timeInterval < 0 ? 0 : timeInterval) / 31536000 * (prevApr * userDepositInUsd);
            sPrimeValue[depositor.id][transfer.tokenSymbol].sPrime = Number(sPrimeValue[depositor.id][transfer.tokenSymbol].sPrime) + newValue * 0.75;
            sPrimeValue[depositor.id][transfer.tokenSymbol]['timestamp'] = transfer.timestamp;
            sPrimeValue[depositor.id][transfer.tokenSymbol]['offset'] = offset + poolTransfersLen;
            sPrimeValue[depositor.id][transfer.tokenSymbol]['curPoolTvl'] = transfer.curPoolTvl;
          }
        );
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

      const params = {
        TableName: networkConfig.database,
        Item: data
      };
      await dynamoDb.put(params).promise();
    })
  );

  console.log("sPRIME values successfully updated.")

  return event;
};

module.exports.handler = sPrimeCalculator;
