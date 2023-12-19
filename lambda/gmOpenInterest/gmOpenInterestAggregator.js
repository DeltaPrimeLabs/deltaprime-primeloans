const ethers = require('ethers');
const fetch = require('node-fetch');

const {
  avalancheProvider,
  arbitrumProvider,
  formatUnits,
  parseUnits,
  dynamoDb,
} = require('../utils/helpers');
const gmxReaderInfo = require("../abis/GmxReader.json");
const gmConfig = require("../config/gmConfig.json");

const gmOpenInterestAggregator = async (event) => {
  const openInterestsAtTimestamp = {};
  const now = Date.now();

  await Promise.all(Object.entries(gmConfig).map(async ([network, data]) => {
    const gmxReaderContract = new ethers.Contract(data.reader, gmxReaderInfo.abi, network === "avalanche" ? avalancheProvider : arbitrumProvider);

    await Promise.all(Object.entries(data.markets).map(async ([marketId, marketData]) => {
      const indexTokenSymbol = marketData.indexTokenSymbol;
      const indexTokenDecimals = marketData.indexTokenDecimals;
      const market = {
        marketToken: marketData.address,
        indexToken: marketData.longTokenAddress,
        longToken: marketData.longTokenAddress,
        shortToken: marketData.shortTokenAddress
      }

      const redstonePriceDataRequest = await fetch(data.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      const price = redstonePriceData[indexTokenSymbol] ? redstonePriceData[indexTokenSymbol][0].dataPoints[0].value.toFixed(30 - indexTokenDecimals) : 0;
      const indexTokenPrice = {
        min: parseUnits(price.toString(), 30 - indexTokenDecimals),
        max: parseUnits(price.toString(), 30 - indexTokenDecimals)
      };

      const openLongInRaw = await gmxReaderContract.getOpenInterestWithPnl(data.dataStore, market, indexTokenPrice, true, true);
      const openShortInRaw = await gmxReaderContract.getOpenInterestWithPnl(data.dataStore, market, indexTokenPrice, false, true);

      const openLong = parseFloat(formatUnits(openLongInRaw, 30));
      const openShort = parseFloat(formatUnits(openShortInRaw, 30));

      const longDominance = openLong / (openLong + openShort);

      openInterestsAtTimestamp[marketId] = longDominance;
    }))
  }))
  console.log(openInterestsAtTimestamp)

  const data = {
    id: now.toString(),
    ...openInterestsAtTimestamp
  };

  const params = {
    TableName: process.env.GM_OPEN_INTEREST_TABLE,
    Item: data
  };
  await dynamoDb.put(params).promise();

  return event;
}

module.exports.handler = gmOpenInterestAggregator;
