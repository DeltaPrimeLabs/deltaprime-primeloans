const ethers = require('ethers');
const { BigNumber } = require('ethers');
const fetch = require('node-fetch');

const {
  avalancheProvider,
  arbitrumProvider,
  toWei
} = require('../utils/helpers');
const gmxReaderInfo = require("../abis/GmxReader.json");
const gmConfig = require("../config/gmConfig.json");

const gmOpenInterestAggregator = async (event) => {
  for (const [network, data] of Object.entries(gmConfig)) {
    const gmxReaderContract = new ethers.Contract(data.reader, gmxReaderInfo.abi, network === "avalanche" ? avalancheProvider : arbitrumProvider);

    for (const [marketId, marketData] of Object.entries(data.markets)) {
      const market = {
        marketToken: marketData.address,
        indexToken: marketData.indexTokenAddress,
        longToken: marketData.longTokenAddress,
        shortToken: marketData.shortTokenAddress
      }

      const redstonePriceDataRequest = await fetch(data.redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      const price = redstonePriceData[marketId] ? redstonePriceData[marketId][0].dataPoints[0].value : 0;
      const indexTokenPrice = {
        min: toWei(price),
        max: toWei(price)
      };

      const openLong = await gmxReaderContract.getOpenInterestWithPnl(data.dataStore, market, indexTokenPrice, true, true);
      const openShort = await gmxReaderContract.getOpenInterestWithPnl(data.dataStore, market, indexTokenPrice, false, true);
      console.log("openLong: ", openLong.toString());
      console.log("openShort: ", openShort.toString());

      const longDominance = BigNumber.from(openLong).div(BigNumber.from(openLong).add(BigNumber.from(openShort)));

      console.log(marketId, longDominance.toString());
    }
  }

  return event;
}

module.exports.handler = gmOpenInterestAggregator;