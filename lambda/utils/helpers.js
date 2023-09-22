const ethers = require('ethers');

// String -> BigNumber
const parseUnits = ethers.utils.parseUnits;
// BigNumber -> String
const formatUnits = ethers.utils.formatUnits;

module.exports = {
  parseUnits,
  formatUnits
}