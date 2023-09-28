const ethers = require('ethers');
const redstone = require('redstone-api');
const poolTokenSymbols = require('./constants.json');

// String -> BigNumber
const parseUnits = ethers.utils.parseUnits;
// BigNumber -> String
const formatUnits = ethers.utils.formatUnits;

const getHistoricalTokenPrice = async (token, timestamp) => {
  let depth = 0;
  while (1) {
    let resp = await redstone.getHistoricalPrice([token], {
      date: (timestamp + depth * 600) * 1000,
    });

    if ('value' in resp[token]) return resp[token].value;
    depth++;
  }
}

const getSymbolFromPoolAddress = (network, address) => {
  return poolTokenSymbols[network].pools[address];
}

module.exports = {
  parseUnits,
  formatUnits,
  getHistoricalTokenPrice,
  getSymbolFromPoolAddress
}