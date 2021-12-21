const addresses = require("../common/token_addresses.json");
const toBytes32 = require("ethers").utils.formatBytes32String;
const AssetsExchange = artifacts.require("./PangolinExchange.sol");

module.exports = function(deployer) {
  deployer.deploy(AssetsExchange,
    "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106",
    [
      { asset: toBytes32('AVAX'), assetAddress: addresses["AVAX"]},
      { asset: toBytes32('ETH'), assetAddress: addresses["ETH"]},
      { asset: toBytes32('BTC'), assetAddress: addresses["BTC"]},
      { asset: toBytes32('USDT'), assetAddress: addresses["USDT"]},
      { asset: toBytes32('LINK'), assetAddress: addresses["LINK"]},
      { asset: toBytes32('PNG'), assetAddress: addresses["PNG"]},
      { asset: toBytes32('XAVA'), assetAddress: addresses["XAVA"]},
      { asset: toBytes32('FRAX'), assetAddress: addresses["FRAX"]}
    ]
  );
};
