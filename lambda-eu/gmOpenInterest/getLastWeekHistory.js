const ethers = require('ethers');
const fetch = require('node-fetch');
const redstone = require('redstone-api');

const {
  avalancheProvider,
  arbitrumProvider,
  formatUnits,
  parseUnits,
  dynamoDb,
  getBlockForTimestamp
} = require('../utils/helpers');
const gmxReaderInfo = require("../abis/GmxReader.json");
const gmConfig = require("../config/gmConfig.json");

const getLastWeekHistory = async (event) => {
  let params = {
    TableName: 'gm-open-interest-prod',
  };

  const res = await dynamoDb.scan(params).promise();

  if (res.Items.length == 0) {
    // fill the last week history
    const now = Date.now();
    let timestampInSeconds = now - 7 * 24 * 60 * 60 * 1000;

    let prices = {};

    for (const [network, data] of Object.entries(gmConfig)) {
      for (const [marketId, marketData] of Object.entries(data.markets)) {
        const resp = await redstone.getHistoricalPrice(marketData.indexTokenSymbol, {
          startDate: timestampInSeconds - 60 * 60 * 1000,
          interval: 3 * 60 * 60 * 1000, // every 3 hours
          endDate: now,
          provider: "redstone"
        });

        if (!prices[marketData.indexTokenSymbol]) {
          prices[marketData.indexTokenSymbol] = resp;
        }
      }
    }

    while (timestampInSeconds <= now) {
      console.log(`Processed timestamp: ${timestampInSeconds}`);
      const openInterestsAtTimestamp = {};

      await Promise.all(Object.entries(gmConfig).map(async ([network, data]) => {
        let blockNumber = (await getBlockForTimestamp(network, timestampInSeconds)).block;

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

          const openLongInRaw = await gmxReaderContract.getOpenInterestWithPnl(data.dataStore, market, indexTokenPrice, true, true, { blockTag: blockNumber });
          const openShortInRaw = await gmxReaderContract.getOpenInterestWithPnl(data.dataStore, market, indexTokenPrice, false, true, { blockTag: blockNumber });

          const openLong = parseFloat(formatUnits(openLongInRaw, 30));
          const openShort = parseFloat(formatUnits(openShortInRaw, 30));

          const longDominance = openLong / (openLong + openShort);

          openInterestsAtTimestamp[marketId] = longDominance;
        }))
      }))

      const data = {
        id: timestampInSeconds.toString(),
        ...openInterestsAtTimestamp
      };
      console.log(data);

      const params = {
        TableName: 'gm-open-interest-prod',
        Item: data
      };
      await dynamoDb.put(params).promise();

      timestampInSeconds += 3 * 60 * 60 * 1000;
    }
  }

  return event;
}

// getLastWeekHistory();
