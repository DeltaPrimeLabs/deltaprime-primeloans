const web3Abi  = require('web3-eth-abi');
const addresses = require("../common/token_addresses.json");
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../tools/scripts/embed-commit-hash");
const hre = require("hardhat");
import verifyContract from "../tools/scripts/verify-contract";
const toBytes32 = require("ethers").utils.formatBytes32String;

const pangolinRouter = "0x2D99ABD9008Dc933ff5c0CD271B88309593aB921";

const supportedAssets = [
    { asset: toBytes32('AVAX'), assetAddress: addresses["AVAX"]},
    {asset: toBytes32('ETH'), assetAddress: addresses["ETH"]},
    {asset: toBytes32('BTC'), assetAddress: addresses["BTC"]},
    {asset: toBytes32('USDT'), assetAddress: addresses["USDT"]}
]
module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('PangolinExchange');
    embedCommitHash('PangolinExchangeTUP', './contracts/proxies');

    let resultImpl = await deploy('PangolinExchange', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    await verifyContract(hre, {
        address: resultImpl.address
    })

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

    await verifyContract(hre, {
        address: resultTup.address,
        contract: "contracts/proxies/PangolinExchangeTUP.sol:PangolinExchangeTUP",
        constructorArguments: [
            exchange.address,
            admin,
            calldata
        ]
    });

    console.log(`PangolinExchangeTUP deployed at address: ${resultTup.address} by a factory`);

};

module.exports.tags = ['init'];
