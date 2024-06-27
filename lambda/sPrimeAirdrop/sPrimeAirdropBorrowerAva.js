const ethers = require('ethers');
const {
  dynamoDb,
  // avalancheHistoricalProvider,
  formatUnits
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const EthDater = require("ethereum-block-by-date");
const assetsPrices = require('./historicalPrices.json');
const airdropRpc = require('../.secrets/airdropRpc.json');

const blockTimestampStart = 1696224800;
const blockTimestampEnd = 1712454400;

const avalancheFactoryAddress = constants.avalanche.factory;

const avalancheHistoricalProvider = new ethers.providers.JsonRpcProvider(airdropRpc.avalanche);

const findClosest = (numbers, pool, target) => {
  let timestamps = Object.keys(numbers);
  let closest = timestamps[0];
  if (!closest) return 0;

  let closestDiff = Math.abs(target - closest);

  // Calculate the difference between the target and closest
  for (let i = 1; i < timestamps.length; i++) {
    let current = timestamps[i];
    let currentDiff = Math.abs(target - current);

    if (currentDiff < closestDiff) {
      closest = current;
      closestDiff = currentDiff;
    }
  }

  let poolToken = numbers[closest].find(asset => asset.dataFeedId === pool)
  let price = poolToken ? poolToken.value : 0;

  return price;
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
    case "AVAX":
      return 18;
    case "USDC":
      return 6;
    case "USDT":
      return 6;
    case "BTC":
      return 8;
    case "ETH":
      return 18;
  }
}

function getSubgraphEndpoint(chain) {
  switch (chain) {
    case "avalanche":
      return "https://api.studio.thegraph.com/query/78666/deltaprime/v0.0.1";
    case "arbitrum":
      return `https://gateway-arbitrum.network.thegraph.com/api/${subgraphConfig.arbitrum}/subgraphs/id/839tNWmeEHHDN41Tq83PAuv7JRw3raUJc6phkcgRAqjR`;
  }
}

async function getPoolContracts(chain) {
  switch (chain) {
    case "avalanche":
      return {
        'AVAX': new ethers.Contract("0xD26E504fc642B96751fD55D3E68AF295806542f5", POOL_ARTIFACT.abi, provider),
        'USDC': new ethers.Contract("0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b", POOL_ARTIFACT.abi, provider),
        'USDT': new ethers.Contract("0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1", POOL_ARTIFACT.abi, provider),
        'BTC': new ethers.Contract("0x475589b0Ed87591A893Df42EC6076d2499bB63d0", POOL_ARTIFACT.abi, provider),
        'ETH': new ethers.Contract("0xD7fEB276ba254cD9b34804A986CE9a8C3E359148", POOL_ARTIFACT.abi, provider),
      }
    case "arbitrum":
      return {
        'USDC': new ethers.Contract("0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0", POOL_ARTIFACT.abi, provider),
        'ETH': new ethers.Contract("0x0BeBEB5679115f143772CfD97359BBcc393d46b3", POOL_ARTIFACT.abi, provider),
        'ARB': new ethers.Contract("0x2B8C610F3fC6F883817637d15514293565C3d08A", POOL_ARTIFACT.abi, provider),
        'BTC': new ethers.Contract("0x5CdE36c23f0909960BA4D6E8713257C6191f8C35", POOL_ARTIFACT.abi, provider),
        'DAI': new ethers.Contract("0xd5E8f691756c3d7b86FD8A89A06497D38D362540", POOL_ARTIFACT.abi, provider),
      }
  }
}

const getPoolsFirstDeposits = async (pools, chain) => {
  let firstDeposits = {};

  await Promise.all(
    Object.keys(pools).map(async pool => {
      let query = gql`
          {
            transfers(
              first: 1
              orderDirection: asc
              orderBy: timestamp
              where: {tokenSymbol: "${pool}"}
            ) {
              timestamp
            }
          }
          `
      let response = await request(getSubgraphEndpoint(chain), query);
      firstDeposits[pool] = Number(response.transfers[0].timestamp);
    })
  )
  console.log(firstDeposits)

  return firstDeposits;
}

async function getBorrowerDebtValues(loanAddresses, pools, poolsFirstDeposits, blockNumber, assetsPrices, timestampInSeconds) {
  let loansValues = {};
  const batchSize = 50; // Define your batch size here

  let poolTokenPrices = {};

  Object.keys(pools).map(poolName => {
    poolTokenPrices[poolName] = findClosest(assetsPrices, poolName, timestampInSeconds);
  })
  console.log(poolTokenPrices)

  console.log(`Checking balances of ${loanAddresses.length} loans in batches of ${batchSize}`)
  for (let i = 0; i < loans.length; i += batchSize) {
    let batch = loans.slice(i, i + batchSize);
    let balancePromises = batch.map(loan => Promise.all(Object.entries(pools).map(([pool, poolContract]) => poolsFirstDeposits[pool] <= timestampInSeconds ? poolContract.getBorrowed(loan, { blockTag: blockNumber }) : 0)));
    let balances = await Promise.all(balancePromises);
    for (let j = 0; j < balances.length; j++) {
      let balance = 0;
      let debtsInUsd = 0;

      Object.keys(pools).map((poolName, id) => {
        balance = formatUnits(balances[j][id], getPoolDecimals(poolName));
        debtsInUsd += Number(balance) * (poolTokenPrices[poolName] ? Number(poolTokenPrices[poolName]) : 0);
      })

      loansValues[batch[j]] = debtsInUsd;
    }

    // wait 1 second for stability
    await new Promise((resolve, reject) => setTimeout(resolve, 1000));
  }
  // console log sum of values of all loans

  let sum = Object.values(loansValues).reduce((a, b) => a + b, 0);
  console.log(`Sum of loans values: ${sum}`);
  return loansValues;
}

async function sPrimeAirdropBorrowerAva(chain) {
  let pools = await getPoolContracts(chain);

  let timestampInSeconds = blockTimestampStart;

  while (timestampInSeconds <= blockTimestampEnd) {
    console.log(`---------------processing at ${timestampInSeconds}-------------------------`)
    let blockNumber = (await getBlockForTimestamp(timestampInSeconds * 1000)).block;

    let factoryContract = new ethers.Contract(avalancheFactoryAddress, FACTORY.abi, avalancheHistoricalProvider);
    let loanAddresses = await factoryContract.getAllLoans({ blockTag: blockNumber });

    let poolsFirstDeposits = await getPoolsFirstDeposits(pools, chain);
    let borrowerDebtValues = await getBorrowerDebtValues(loanAddresses, pools, poolsFirstDeposits, blockNumber, assetsPrices, timestampInSeconds);
    console.log(borrowerDebtValues)
    console.log(Object.keys(borrowerDebtValues).length)

    // save/update incentives values to DB
    await Promise.all(
      Object.entries(loanDebts).map(async ([loanId, value]) => {
        const data = {
          id: loanId,
          timestamp: timestampInSeconds,
          debt: value
        };

        const params = {
          TableName: 'sprime-airdrop-borrower-ava',
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );

    timestampInSeconds += 60 * 60 * 24 * 7;
    await new Promise((resolve, reject) => setTimeout(resolve, 5000));
  }
}

sPrimeAirdropBorrowerAva('avalanche');