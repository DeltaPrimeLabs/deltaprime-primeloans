const web3Abi  = require('web3-eth-abi');
const addresses = require("../../common/addresses/avax/token_addresses.json");
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
const hre = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
const toBytes32 = require("ethers").utils.formatBytes32String;
import PangolinIntermediaryArtifact from "../../artifacts/contracts/integrations/avalanche/PangolinIntermediary.sol/PangolinIntermediary.json";

const pangolinRouter = "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106";

const pangolinSupportedAssets = [
    asset('AVAX'),
    asset('USDC'),
    asset('ETH'),
    asset('sAVAX'),
    asset('USDT'),
    asset('PNG'),
    asset('PTP'),
    asset('QI'),
    asset('PNG_AVAX_USDC_LP'),
    asset('PNG_AVAX_USDT_LP'),
    asset('PNG_AVAX_ETH_LP')
]

function asset(symbol) {
    return { asset: toBytes32(symbol), assetAddress: addresses[symbol] }
}

module.exports = async ({
    getNamedAccounts,
    deployments
}) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

    embedCommitHash('PangolinIntermediary', './contracts/integrations/avalanche');
    embedCommitHash('PangolinIntermediaryTUP', './contracts/proxies/tup/avalanche');

    let resultImpl = await deploy('PangolinIntermediary', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    console.log(`PangolinIntermediary implementation deployed at address: ${resultImpl.address} by a factory`);

    const exchange = await ethers.getContract("PangolinIntermediary");

    const calldata = web3Abi.encodeFunctionCall(
        PangolinIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [pangolinRouter, pangolinSupportedAssets.map(asset => asset.assetAddress)]
    )

    let resultTup = await deploy('PangolinIntermediaryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [exchange.address, admin, calldata],
    });

    console.log(`PangolinIntermediaryTUP deployed at address: ${resultTup.address} by a factory`);

};

module.exports.tags = ['avalanche'];
