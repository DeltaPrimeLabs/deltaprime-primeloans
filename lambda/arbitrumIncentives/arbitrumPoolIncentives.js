const ethers = require('ethers');
const fetch = require('node-fetch');
const POOL_ARTIFACT = require('../abis/Pool.json');
const { request, gql } = require('graphql-request');
const incentivesRpcUrl = require('../.secrets/incentivesRpc.json');
const pingUrl = require('../.secrets/ping.json');
const { dynamoDb } = require('../utils/helpers');

function getRpcUrl(chain, rpc) {
  // switch(chain){
  //     case "avalanche":
  //         return "https://api.avax.network/ext/bc/C/rpc";
  //     case "arbitrum":
  //         return "https://arb.nirvanalabs.xyz/arbitrum_aws?apikey=???";
  // }
  return incentivesRpcUrl[chain][rpc];
}

function getProvider(chain, rpc) {
  return new ethers.providers.JsonRpcProvider(getRpcUrl(chain, rpc));
}

let redstonePrices = {};
async function getPrice(asset, chain = "arbitrum") {
  if (!Object.keys(redstonePrices).includes(asset)) {
    redstonePrices[asset] = (await getRedstonePrices([asset], chain))[0];
  }
  return redstonePrices[asset]
}

const getRedstonePrices = async function (tokenSymbols, chain = "arbitrum") {
  const rs_cache_url = "https://oracle-gateway-1.a.redstone.finance";
  const dataServiceId = process.env.dataServiceId ?? `redstone-${chain}-prod`;
  const url = `${rs_cache_url}/data-packages/latest/${dataServiceId}`

  const response = await fetch(url);
  const redstonePrices = await response.json();

  let result = [];
  for (const symbol of tokenSymbols) {
    result.push(getPricesWithLatestTimestamp(redstonePrices, symbol));
  }
  return result;
}

function getPricesWithLatestTimestamp(prices, symbol) {
  if (symbol in prices) {
    let symbolPriceObject = prices[symbol];
    let currentNewestTimestampIndex = 0;
    for (let i = 0; i < symbolPriceObject.length; i++) {
      if (symbolPriceObject[i].timestampMilliseconds > symbolPriceObject[currentNewestTimestampIndex].timestampMilliseconds) {
        currentNewestTimestampIndex = i;
      }
    }
    return symbolPriceObject[currentNewestTimestampIndex].dataPoints[0].value;
  } else {
    throw new Error(`Symbol ${symbol} not found in the prices object`);
  }
}

function getPoolDecimals(chain, pool) {
  switch (chain) {
    case "avalanche":
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
    case "arbitrum":
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

}

async function getPoolContracts(chain, provider) {
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

async function getPoolDeposits(pools, chain) {
  let _poolsDeposits = {};

  for (let pool in pools) {
    let poolDeposits = await pools[pool].totalSupply();
    let poolDecimals = getPoolDecimals(chain, pool);
    let poolDepositsNormalized = ethers.utils.formatUnits(poolDeposits, poolDecimals);
    console.log(`${pool} deposits: ${poolDepositsNormalized.toString()}`);
    _poolsDeposits[pool] = poolDepositsNormalized;
  }
  return _poolsDeposits;
}

async function getPoolsTVL(poolsDeposits, chain) {
  let _poolsTVL = {};
  for (let pool in poolsDeposits) {
    let poolTokenDollarValue = await getPrice(pool, chain);
    let poolTVL = poolsDeposits[pool] * poolTokenDollarValue;
    console.log(`${pool} TVL: $${poolTVL.toString()}`);
    _poolsTVL[pool] = poolTVL;
  }
  return _poolsTVL;

}

function getPoolEligibleTVLMultiplier(chain, pool) {
  switch (chain) {
    case "avalanche":
      switch (pool) {
        case "AVAX":
          return 1;
        case "USDC":
          return 1.5;
        case "USDT":
          return 1.5;
        case "BTC":
          return 1;
        case "ETH":
          return 1;
        default:
          return 1;
      }
    case "arbitrum":
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
          return 1.0;
        default:
          return 1;
      }
  }

}

function getSubgraphEndpoint(chain) {
  switch (chain) {
    case "avalanche":
      return "https://api.thegraph.com/subgraphs/name/mbare0/deltaprime";
    case "arbitrum":
      return "https://api.thegraph.com/subgraphs/name/keizir/deltaprime";
  }
}

async function getDepositorsAddressesFromSubgraph(chain) {
  let skip = 0;
  let depositors = [];
  let hasMoreDepositors = true;

  while (hasMoreDepositors) {
    let query = gql`
        {
          depositors(first: 1000, skip: ${skip}) {
            id
          }
        }
        `
    let response = await request(getSubgraphEndpoint(chain), query);
    if (response.depositors.length > 0) {
      depositors = [...depositors, ...response.depositors.map(depositor => depositor.id)];
      skip += 1000;
    } else {
      hasMoreDepositors = false;
    }
  }
  // remove duplicates from depositors array
  depositors = [...new Set(depositors)];

  console.log(`Found ${depositors.length} depositors.`);
  return depositors;
}

async function getDepositorsBalances(depositors, poolContract, poolName, chain) {
  let depositorsBalances = {};
  const batchSize = 200; // Define your batch size here

  console.log(`Checking ${poolName} pool balances of ${depositors.length} depositors in batches of ${batchSize}`)
  for (let i = 0; i < depositors.length; i += batchSize) {
    let batch = depositors.slice(i, i + batchSize);
    let balancePromises = batch.map(depositor => poolContract.balanceOf(depositor));
    let balances = await Promise.all(balancePromises);
    for (let j = 0; j < balances.length; j++) {
      let balance = ethers.utils.formatUnits(balances[j], getPoolDecimals(chain, poolName));
      if (balance > 0) { // Only add depositors with a balance greater than 0
        depositorsBalances[batch[j]] = Number(balance);
      }
    }
  }
  // console log sum of balances of all depositors
  let sum = Object.values(depositorsBalances).reduce((a, b) => a + b);
  console.log(`Sum of ${poolName} depositors balances: ${sum}`);
  return depositorsBalances;
}

async function calculateEligibleAirdropPerPool(numberOfTokensToBeDistributed, chain, rpc = "first") {
  let startTime = Date.now();
  let provider = getProvider("arbitrum", rpc);
  let arbitrumPools = await getPoolContracts(chain, provider);
  let arbitrumPoolsDeposits = await getPoolDeposits(arbitrumPools, chain);
  let arbitrumPoolsTVL = await getPoolsTVL(arbitrumPoolsDeposits, chain);
  let tokensToBeDistributedPerPool = {};
  let poolsDepositors = []
  let poolsDepositorsBalances = {}
  let depositorsEligibleAirdrop = {};

  try {
    poolsDepositors = await getDepositorsAddressesFromSubgraph(chain);
    for (let pool in arbitrumPoolsTVL) {
      let poolEligibleTVLMultiplier = getPoolEligibleTVLMultiplier(chain, pool);
      console.log(`${pool} eligible TVL multiplier: ${poolEligibleTVLMultiplier}`)
      let poolTVL = arbitrumPoolsTVL[pool] * poolEligibleTVLMultiplier;
      let arbitrumPoolsTVLArray = Object.entries(arbitrumPoolsTVL).map(([pool, tvl]) => ({ pool, tvl }));

      let totalTVL = arbitrumPoolsTVLArray.reduce((a, b) => a + (b.tvl * getPoolEligibleTVLMultiplier(chain, b.pool)), 0);
      let poolTokensToBeDistributed = (poolTVL / totalTVL) * numberOfTokensToBeDistributed;
      tokensToBeDistributedPerPool[pool] = poolTokensToBeDistributed;
      console.log(`${pool} eligible airdrop: ${tokensToBeDistributedPerPool[pool]}`);
      poolsDepositorsBalances[pool] = await getDepositorsBalances(poolsDepositors, arbitrumPools[pool], pool, chain);
    }


    for (let pool in poolsDepositorsBalances) {
      depositorsEligibleAirdrop[pool] = {};
      const totalDepositorsBalances = Object.values(poolsDepositorsBalances[pool]).reduce((a, b) => a + b);
      for (let depositor in poolsDepositorsBalances[pool]) {
        let depositorBalance = poolsDepositorsBalances[pool][depositor];
        let poolEligibleAirdrop = tokensToBeDistributedPerPool[pool];
        let depositorEligibleAirdrop = (depositorBalance / totalDepositorsBalances) * poolEligibleAirdrop;
        depositorsEligibleAirdrop[pool][depositor] = depositorEligibleAirdrop;
      }
    }

    // save airdrops to database
    await Promise.all(
      Object.entries(depositorsEligibleAirdrop).map(async ([pool, poolAirdrop]) => {
        await Promise.all(
          Object.entries(poolAirdrop).map(async ([depositor, airdrop]) => {
            const params = {
              TableName: 'pool-arbitrum-incentives-arb-prod',
              Key: {
                id: depositor,
                timestamp: Math.floor(startTime / 1000)
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

    await fetch(pingUrl.ltipPool.success);
    console.log('==============calculating success=============');
  } catch (error) {
    console.log(error);

    if (error.error.code == "SERVER_ERROR") {
      calculateEligibleAirdropPerPool(372, "arbitrum", "second")
    } else {
      await fetch(pingUrl.ltipPool.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(error)
      });
      console.log('-----------calculating failed------------');
    }
  }

  // for each pool sum up depositors eligible airdrops and verify if they sum up to each pool's eligible airdrop
  for (let pool in depositorsEligibleAirdrop) {
    let sum = Object.values(depositorsEligibleAirdrop[pool]).reduce((a, b) => a + b);
    console.log(`Sum of ${pool} depositors eligible airdrops: ${sum}`);
    console.log(`Eligible airdrop for ${pool}: ${tokensToBeDistributedPerPool[pool]}`);
    // % diff between sum of depositors eligible airdrops and pool's eligible airdrop
    const diff = Math.abs(((sum - tokensToBeDistributedPerPool[pool]) / tokensToBeDistributedPerPool[pool]) * 100);
    console.log(`sum: ${sum}, expected:${tokensToBeDistributedPerPool[pool]}, diff(&): ${diff}`);

    if (diff < 0.001) {
      await fetch(pingUrl.ltipPoolChcker.success);
      console.log(`============difference check for ${pool} success==============`);
    } else {
      await fetch(pingUrl.ltipPoolChcker.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(`difference calculated: ${diff}`)
      });
      console.log(`------------difference check for ${pool} failed-------------`)
    }
  }

  console.log(`Execution time: ${Date.now() - startTime} ms`);
}

calculateEligibleAirdropPerPool(372, "arbitrum")