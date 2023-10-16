const ethers = require("ethers");
const {
  dynamoDb,
} = require("../utils/helpers");
const levelConfig = require('../config/levelApy.json');

const formatUnits = (val, decimals) => parseFloat(ethers.utils.formatUnits(val, decimals));

const levelTvlAggregator = async () => {
  console.log('fetching TVLs from Level..');
  const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";

  // fetch APYs from Level on Arbitrum
  const resp = await fetch(levelApiUrl);
  const liquidityPerformance = await resp.json();

  const arbLP = liquidityPerformance.find(item => item.chainId == 42161);
  for (const lpInfo of arbLP.lpInfos) {
    const liquidityInUsd = formatUnits(lpInfo.totalSupply, 18) * formatUnits(lpInfo.price, 12);
    console.log(liquidityInUsd);

    const tvl = {
      id: levelConfig[lpInfo.name].symbol,
      tvl: liquidityInUsd
    };

    const params = {
      TableName: process.env.APY_TABLE,
      Item: tvl
    };
    await dynamoDb.put(params).promise();
  }
}

module.exports.levelTvlAggregator = levelTvlAggregator;