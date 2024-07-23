const ethers = require('ethers');
const fetch = require('node-fetch');
const fs = require("fs");
const POOL_ARTIFACT = require('../abis/Pool.json');
const { request, gql } = require('graphql-request');
const incentivesRpcUrl = require('../.secrets/incentivesRpc.json');
const pingUrl = require('../.secrets/ping.json');
const { dynamoDb, fetchAllDataFromDB } = require('../utils/helpers');
const chainbaseConfig = require('../.secrets/chainbase.json');

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
          return 1.5;
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

async function getDepositorsAddressesFromChainbase(chain) {
  let chainId;
  let depositors = [];

  if (chain === "arbitrum") {
    chainId = 42161;
  } else if (chain == "avalanche") {
    chainId = 43114;
  }

  const pools = {
    "arbitrum": [
      "0x8FE3842e0B7472a57f2A2D56cF6bCe08517A1De0",
      "0x0BeBEB5679115f143772CfD97359BBcc393d46b3",
      "0x2B8C610F3fC6F883817637d15514293565C3d08A",
      "0x5CdE36c23f0909960BA4D6E8713257C6191f8C35",
      "0xd5E8f691756c3d7b86FD8A89A06497D38D362540"
    ]
  }

  for (let pool of pools[chain]) {
    let page = 1;
    let limit = 100;
    let hasMoreDepositors = true;

    while (hasMoreDepositors) {
      const url = `https://api.chainbase.online/v1/token/holders?chain_id=${chainId}&contract_address=${pool}&page=${page}&limit=${limit}`;
      const response = await fetch(url, {
        headers: {
          "x-api-key": chainbaseConfig.apiKey
        }
      });
      const json = await response.json();

      if (json.data && json.data.length > 0) {
        depositors = [...depositors, ...json.data];
        page++;

        await new Promise((resolve, reject) => setTimeout(resolve, 600));
      } else {
        hasMoreDepositors = false;
      }
    }
  }
  depositors = [...new Set(depositors)];
  console.log(`Found ${depositors.length} depositors.`);

  return depositors;
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
  const batchSize = 100; // Define your batch size here

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

    // wait 1 second for stability
    await new Promise((resolve, reject) => setTimeout(resolve, 1000));
  }
  // console log sum of balances of all depositors
  let sum = Object.values(depositorsBalances).reduce((a, b) => a + b);
  console.log(`Sum of ${poolName} depositors balances: ${sum}`);
  return depositorsBalances;
}

const getIncentivesMultiplier = async (startTime) => {
  const params = {
    TableName: "pool-arbitrum-incentives-arb-prod",
  };

  const res = await fetchAllDataFromDB(params, true);

  if (res.length == 0) return 1;

  res.sort((a, b) => b.timestamp - a.timestamp);

  return Math.round((Math.floor(startTime / 1000) - res[0].timestamp) / 3600);
};

let retryTime = 0;

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
  let incentivesMultiplier = await getIncentivesMultiplier(startTime);

  if (incentivesMultiplier == 0) return;

  try {
    poolsDepositors = await getDepositorsAddressesFromChainbase(chain);
    for (let pool in arbitrumPoolsTVL) {
      let poolEligibleTVLMultiplier = getPoolEligibleTVLMultiplier(chain, pool);
      console.log(`${pool} eligible TVL multiplier: ${poolEligibleTVLMultiplier}`)
      let poolTVL = arbitrumPoolsTVL[pool] * poolEligibleTVLMultiplier;
      let arbitrumPoolsTVLArray = Object.entries(arbitrumPoolsTVL).map(([pool, tvl]) => ({ pool, tvl }));

      let totalTVL = arbitrumPoolsTVLArray.reduce((a, b) => a + (b.tvl * getPoolEligibleTVLMultiplier(chain, b.pool)), 0);
      let poolTokensToBeDistributed = (poolTVL / totalTVL) * numberOfTokensToBeDistributed * incentivesMultiplier;
      tokensToBeDistributedPerPool[pool] = poolTokensToBeDistributed;
      console.log(`${pool} eligible airdrop: ${tokensToBeDistributedPerPool[pool]}`);
      poolsDepositorsBalances[pool] = await getDepositorsBalances(poolsDepositors, arbitrumPools[pool], pool, chain);
    }


    for (let pool in poolsDepositorsBalances) {
      depositorsEligibleAirdrop[pool] = {};
      let totalDepositorsBalances = Object.values(poolsDepositorsBalances[pool]).reduce((a, b) => a + b);
      let poolEligibleAirdrop = tokensToBeDistributedPerPool[pool];

      // save boost APY for pool to DB
      let poolTokenDollarValue = await getPrice(pool, chain);
      const boostApy = (poolEligibleAirdrop / incentivesMultiplier) / (totalDepositorsBalances * poolTokenDollarValue) * 24 * 365;
      const params = {
        TableName: 'statistics-prod',
        Key: {
          id: 'LTIP_POOL'
        },
        AttributeUpdates: {
          [pool]: {
            Value: Number(boostApy) ? boostApy : null,
            Action: 'PUT'
          }
        }
      };

      await dynamoDb.update(params).promise();
      console.log(`LTIP boost pool APY for ${pool} pool on Arbitrum saved.`);

      for (let depositor in poolsDepositorsBalances[pool]) {
        let depositorBalance = poolsDepositorsBalances[pool][depositor];
        console.log(`TotalDepositorsBalances: ${totalDepositorsBalances}`);
        console.log(`arbitrumPoolsDeposits[pool]: ${arbitrumPoolsDeposits[pool]}`);
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

    // save total incentives to DB
    let params = {
      TableName: 'pool-arbitrum-incentives-arb-prod'
    };

    const incentives = await fetchAllDataFromDB(params, true);

    let accumulatedIncentives = 0;

    incentives.map((item) => {
      accumulatedIncentives += (item.ARB ? Number(item.ARB) : 0) +
                              (item.BTC ? Number(item.BTC) : 0) +
                              (item.DAI ? Number(item.DAI) : 0) +
                              (item.ETH ? Number(item.ETH) : 0) +
                              (item.USDC ? Number(item.USDC) : 0);
    });

    params = {
      TableName: "statistics-prod",
      Key: {
        id: "LTIP_POOL"
      },
      AttributeUpdates: {
        totalArb: {
          Value: Number(accumulatedIncentives) ? accumulatedIncentives : null,
          Action: "PUT"
        }
      }
    };

    await dynamoDb.update(params).promise();
    console.log("LTIP Pool total ARB saved.");

    await fetch(pingUrl.ltipPool.success);
    console.log('==============calculating success=============');
  } catch (error) {
    console.log(error);

    if (error.error.code == "SERVER_ERROR" || error.error.code == "TIMEOUT") {
      retryTime += 1;

      if (retryTime === 3) {
        await fetch(pingUrl.ltipPool.fail, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error,
            message: "function retried 3 times and failed yet."
          })
        });
      }

      calculateEligibleAirdropPerPool(49.60317, "arbitrum", rpc == "first" ? "second" : "first")
    } else {
      await fetch(pingUrl.ltipPool.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error,
          message: "function terminated."
        })
      });
      console.log('-----------calculating failed------------');

      await fetch(pingUrl.ltipPoolChcker.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errorMessage: 'incentives calculation failed and not saved to db'
        })
      });

      return;
    }
  }

  // for each pool sum up depositors eligible airdrops and verify if they sum up to each pool's eligible airdrop

  for (let pool in depositorsEligibleAirdrop) {
    const threshold = 1;
    let sum = Object.values(depositorsEligibleAirdrop[pool]).reduce((a, b) => a + b);
    console.log(`Sum of ${pool} depositors eligible airdrops: ${sum}`);
    console.log(`Eligible airdrop for ${pool}: ${tokensToBeDistributedPerPool[pool]}`);
    // % diff between sum of depositors eligible airdrops and pool's eligible airdrop
    const diff = Math.abs(sum - tokensToBeDistributedPerPool[pool]);
    console.log(`sum: ${sum}, expected:${tokensToBeDistributedPerPool[pool]}, diff(&): ${diff}, pool: ${pool}`);

    if (diff < threshold) {
      await fetch(pingUrl.ltipPoolChcker.success);
      console.log(`============difference check for ${pool} success==============`);
    } else {
      await fetch(pingUrl.ltipPoolChcker.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errorMessage: `difference calculated: ${diff} - sum ${sum} - expected ${tokensToBeDistributedPerPool[pool]}`
        })
      });
      console.log(`------------difference check for ${pool} failed-------------`)
    }
  }

  console.log(`Execution time: ${Date.now() - startTime} ms`);
}

calculateEligibleAirdropPerPool(49.60317, "arbitrum") // 100_000 per 12 weeks = 49.60317 per hour