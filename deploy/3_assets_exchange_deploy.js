const web3Abi  = require('web3-eth-abi');
const addresses = require("../common/token_addresses.json");
const {ethers} = require("hardhat");
const toBytes32 = require("ethers").utils.formatBytes32String;

const pangolinRouter = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

const supportedAssets = [
    { asset: toBytes32('AVAX'), assetAddress: addresses["AVAX"]},
    {asset: toBytes32('ETH'), assetAddress: addresses["ETH"]},
    {asset: toBytes32('BTC'), assetAddress: addresses["BTC"]},
    {asset: toBytes32('USDT'), assetAddress: addresses["USDT"]},
    {asset: toBytes32('LINK'), assetAddress: addresses["LINK"]},
    {asset: toBytes32('PNG'), assetAddress: addresses["PNG"]},
    {asset: toBytes32('XAVA'), assetAddress: addresses["XAVA"]},
    {asset: toBytes32('FRAX'), assetAddress: addresses["FRAX"]},
    {asset: toBytes32('YAK'), assetAddress: addresses["YAK"]},
]
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    let resultImpl = await deploy('PangolinExchange', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    console.log(`PangolinExchange implementation deployed at address: ${resultImpl.address} by a factory`);

    const exchange = await ethers.getContract("PangolinExchange");

    const initializeInterface = {
        "inputs": [
        {
            "internalType": "address",
            "name": "_pangolinRouter",
            "type": "address"
        },
        {
            "components": [
                {
                    "internalType": "bytes32",
                    "name": "asset",
                    "type": "bytes32"
                },
                {
                    "internalType": "address",
                    "name": "assetAddress",
                    "type": "address"
                }
            ],
            "internalType": "struct IAssetsExchange.Asset[]",
            "name": "supportedAssets",
            "type": "tuple[]"
        }
    ],
        "name": "initialize",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }


    const calldata = web3Abi.encodeFunctionCall(
        initializeInterface,
        [pangolinRouter, supportedAssets]
    )

    let resultTup = await deploy('PangolinExchangeTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [exchange.address, admin, calldata],
    });

    console.log(`PangolinExchangeTUP deployed at address: ${resultTup.address} by a factory`);

};