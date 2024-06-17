const ethers = require('ethers');
const POOL_ARTIFACT = require('../abis/Pool.json');
const extRpcUrl = require('../.secrets/extRpc.json');
const { dynamoDb } = require('../utils/helpers');
const EthDater = require("ethereum-block-by-date");
const redstone = require('redstone-api');
const poolsDepositors = require("./missing.json");

let blockTimestampStart = 1717669800;
let blockTimestampEnd = 1718121600;

// get historical provider
let provider = new ethers.providers.JsonRpcProvider(extRpcUrl.arbitrum);

const poolAssets = ['USDC', 'ETH', 'ARB', 'DAI', 'BTC'];

const getPrices = async () => {
  const assetPrices = {};

  for (let pool of poolAssets) {
    const resp = await redstone.getHistoricalPrice(pool, {
      startDate: (blockTimestampStart - 60 * 60 * 6) * 1000,
      interval: 60 * 60 * 2 * 1000,
      endDate: (blockTimestampEnd + 60 * 60 * 6) * 1000,
      provider: "redstone"
    });

    assetPrices[pool] = resp;
  }

  return assetPrices;
}

const findClosest = (numbers, target) => {

  let closest = numbers[0];
  let closestDiff = Math.abs(target - closest.timestamp);

  // Calculate the difference between the target and closest
  for (let i = 1; i < numbers.length; i++) {
    let current = numbers[i];
    let currentDiff = Math.abs(target - current.timestamp);

    if (currentDiff < closestDiff) {
      closest = current;
      closestDiff = currentDiff;
    }
  }
  return closest.value;
}

const getBlockForTimestamp = async (timestamp) => {
  const dater = new EthDater(
    provider // ethers provider, required.
  );

  return await dater.getDate(
    timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  );
}

function getPoolDecimals(pool) {
  switch (pool) {
    case "USDC":
      return 6;
    case "ETH":
      return 18;
    case "ARB":
      return 18;
    case "BTC":
      return 8;
    case "DAI":
      return 18;
  }
}

async function getPoolContracts() {
  return {
    'USDC': new ethers.Contract("0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0", POOL_ARTIFACT.abi, provider),
    'ETH': new ethers.Contract("0x0BeBEB5679115f143772CfD97359BBcc393d46b3", POOL_ARTIFACT.abi, provider),
    'ARB': new ethers.Contract("0x2B8C610F3fC6F883817637d15514293565C3d08A", POOL_ARTIFACT.abi, provider),
    'BTC': new ethers.Contract("0x5CdE36c23f0909960BA4D6E8713257C6191f8C35", POOL_ARTIFACT.abi, provider),
    'DAI': new ethers.Contract("0xd5E8f691756c3d7b86FD8A89A06497D38D362540", POOL_ARTIFACT.abi, provider),
  }
}

async function getPoolDeposits(pools, blockNumber) {
  let _poolsDeposits = {};

  for (let pool in pools) {
    let poolDeposits = await pools[pool].totalSupply({ blockTag: blockNumber });
    let poolDecimals = getPoolDecimals(pool);
    let poolDepositsNormalized = ethers.utils.formatUnits(poolDeposits, poolDecimals);
    console.log(`${pool} deposits: ${poolDepositsNormalized.toString()}`);
    _poolsDeposits[pool] = poolDepositsNormalized;
  }
  return _poolsDeposits;
}

async function getPoolsTVL(poolsDeposits, assetPrices, timestamp) {
  let _poolsTVL = {};
  for (let pool in poolsDeposits) {
    let poolTokenDollarValue = findClosest(assetPrices[pool], timestamp * 1000);
    let poolTVL = poolsDeposits[pool] * poolTokenDollarValue;
    console.log(`${pool} TVL: $${poolTVL.toString()}`);
    _poolsTVL[pool] = poolTVL;
  }
  return _poolsTVL;

}

function getPoolEligibleTVLMultiplier(pool) {
  switch (pool) {
    case "USDC":
      return 1.5;
    case "ETH":
      return 1;
    case "ARB":
      return 1;
    case "BTC":
      return 1;
    case "DAI":
      return 1.5;
    default:
      return 1;
  }
}

async function getDepositorsBalances(depositors, poolContract, poolName, blockNumber) {
  let depositorsBalances = {};
  const batchSize = 100; // Define your batch size here

  console.log(`Checking ${poolName} pool balances of ${depositors.length} depositors in batches of ${batchSize}`)
  for (let i = 0; i < depositors.length; i += batchSize) {
    let batch = depositors.slice(i, i + batchSize);
    let balancePromises = batch.map(depositor => poolContract.balanceOf(depositor, { blockTag: blockNumber }));
    let balances = await Promise.all(balancePromises);
    for (let j = 0; j < balances.length; j++) {
      let balance = ethers.utils.formatUnits(balances[j], getPoolDecimals(poolName));
      if (balance > 0) { // Only add depositors with a balance greater than 0
        depositorsBalances[batch[j]] = Number(balance);
      }
    }

    // wait 1 second for stability
    await new Promise((resolve, reject) => setTimeout(resolve, 1000));
  }
  // console log sum of balances of all depositors

  let sum = Object.values(depositorsBalances).reduce((a, b) => a + b, 0);
  console.log(`Sum of ${poolName} depositors balances: ${sum}`);
  return depositorsBalances;
}

async function calculateEligibleAirdropPerPool(numberOfTokensToBeDistributed) {
  let assetPrices = await getPrices();
  let arbitrumPools = await getPoolContracts();

  let timestampInSeconds = blockTimestampStart;

  while (timestampInSeconds <= blockTimestampEnd) {
    console.log(`---------------processing at ${timestampInSeconds}-------------------------`)
    let blockNumber = (await getBlockForTimestamp(timestampInSeconds * 1000)).block;
    let arbitrumPoolsDeposits = await getPoolDeposits(arbitrumPools, blockNumber);
    let arbitrumPoolsTVL = await getPoolsTVL(arbitrumPoolsDeposits, assetPrices, timestampInSeconds);
    let tokensToBeDistributedPerPool = {};
    let poolsDepositorsBalances = {}
    let depositorsEligibleAirdrop = {};

    for (let pool in arbitrumPoolsTVL) {
      let poolEligibleTVLMultiplier = getPoolEligibleTVLMultiplier(pool);
      console.log(`${pool} eligible TVL multiplier: ${poolEligibleTVLMultiplier}`)
      let poolTVL = arbitrumPoolsTVL[pool] * poolEligibleTVLMultiplier;
      let arbitrumPoolsTVLArray = Object.entries(arbitrumPoolsTVL).map(([pool, tvl]) => ({ pool, tvl }));

      let totalTVL = arbitrumPoolsTVLArray.reduce((a, b) => a + (b.tvl * getPoolEligibleTVLMultiplier(b.pool)), 0);
      let poolTokensToBeDistributed = (poolTVL / totalTVL) * numberOfTokensToBeDistributed;
      tokensToBeDistributedPerPool[pool] = poolTokensToBeDistributed;
      console.log(`${pool} eligible airdrop: ${tokensToBeDistributedPerPool[pool]}`);
      poolsDepositorsBalances[pool] = await getDepositorsBalances(poolsDepositors, arbitrumPools[pool], pool, blockNumber);
    }


    for (let pool in poolsDepositorsBalances) {
      depositorsEligibleAirdrop[pool] = {};
      let totalDepositorsBalances = Object.values(poolsDepositorsBalances[pool]).reduce((a, b) => a + b, 0);
      let poolEligibleAirdrop = tokensToBeDistributedPerPool[pool];

      for (let depositor in poolsDepositorsBalances[pool]) {
        let depositorBalance = poolsDepositorsBalances[pool][depositor];
        // console.log(`TotalDepositorsBalances: ${totalDepositorsBalances}`);
        // console.log(`arbitrumPoolsDeposits[pool]: ${arbitrumPoolsDeposits[pool]}`);
        // let depositorEligibleAirdrop = (depositorBalance / totalDepositorsBalances) * poolEligibleAirdrop;
        let depositorEligibleAirdrop = (depositorBalance / arbitrumPoolsDeposits[pool]) * poolEligibleAirdrop;
        depositorsEligibleAirdrop[pool][depositor] = depositorEligibleAirdrop;
      }
    }

    // save airdrops to database
    await Promise.all(
      Object.entries(depositorsEligibleAirdrop).map(async ([pool, poolAirdrop]) => {
        await Promise.all(
          Object.entries(poolAirdrop).map(async ([depositor, airdrop]) => {
            const params = {
              TableName: 'ltip-recovery',
              Key: {
                id: depositor,
                timestamp: Math.floor(timestampInSeconds)
              },
              AttributeUpdates: {
                [pool]: {
                  Value: airdrop,
                  Action: "PUT"
                }
              }
            };
            await dynamoDb.update(params).promise();
          })
        )
      })
    )

    timestampInSeconds += 60 * 60 * 6;
  }
}

calculateEligibleAirdropPerPool(49.60317 * 6, "arbitrum") // 100_000 per 12 weeks = 49.60317 per hour