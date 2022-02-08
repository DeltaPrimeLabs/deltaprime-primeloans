const web3Abi  = require('web3-eth-abi');
const addresses = require("../common/token_addresses.json");
const toBytes32 = require("ethers").utils.formatBytes32String;
const AssetsExchange = artifacts.require("./PangolinExchange.sol");
const PangolinExchangeTUP = artifacts.require("./PangolinExchangeTUP.sol");

const pangolinRouter = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";
const supportedAssets = [
    { asset: toBytes32('AVAX'), assetAddress: addresses["AVAX"]},
    {asset: toBytes32('ETH'), assetAddress: addresses["ETH"]},
    {asset: toBytes32('BTC'), assetAddress: addresses["BTC"]},
    {asset: toBytes32('USDT'), assetAddress: addresses["USDT"]},
    {asset: toBytes32('LINK'), assetAddress: addresses["LINK"]},
    {asset: toBytes32('PNG'), assetAddress: addresses["PNG"]},
    {asset: toBytes32('XAVA'), assetAddress: addresses["XAVA"]},
    {asset: toBytes32('FRAX'), assetAddress: addresses["FRAX"]}
]

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(AssetsExchange);
    console.log(`Deployed PangolinAssetsExchange implementation contract at address: ${AssetsExchange.address}`);


    const calldata = web3Abi.encodeFunctionCall(
        AssetsExchange._json.abi.find(obj => obj.name === "initialize"),
        [pangolinRouter, supportedAssets]
    )
    await deployer.deploy(PangolinExchangeTUP, AssetsExchange.address, accounts[1], calldata);
    console.log(`Deployed PangolinExchange (TransparentUpgradeableProxy). Proxy address: ${PangolinExchangeTUP.address}`);
    console.log(`Initialized with: [pangolinRouter: ${pangolinRouter}, supportedAssets: ${JSON.stringify(supportedAssets)}]`)
};
