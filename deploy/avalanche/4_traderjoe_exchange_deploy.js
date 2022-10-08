const web3Abi  = require('web3-eth-abi');
const addresses = require("../../common/addresses/avax/token_addresses.json");
const {ethers} = require("hardhat");
const {embedCommitHash} = require("../../tools/scripts/embed-commit-hash");
const hre = require("hardhat");
import verifyContract from "../../tools/scripts/verify-contract";
const toBytes32 = require("ethers").utils.formatBytes32String;
import TraderJoeIntermediaryArtifact from "../../artifacts/contracts/integrations/avalanche/TraderJoeIntermediary.sol/TraderJoeIntermediary.json";

const traderJoeRouter = "0x60aE616a2155Ee3d9A68541Ba4544862310933d4";

//TODO: update list of tokens:
const traderJoeSupportedAssets = [
    asset('AVAX'),
    asset('USDC'),
    asset('BTC'),
    asset('ETH'),
    asset('USDT'),
    asset('TJ_AVAX_USDC_LP'),
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

    embedCommitHash('TraderJoeIntermediary', './contracts/integrations/avalanche');
    embedCommitHash('TraderJoeIntermediaryTUP', './contracts/proxies/tup/avalanche');

    let resultImpl = await deploy('TraderJoeIntermediary', {
        from: deployer,
        gasLimit: 8000000,
        args: [],
    });

    await verifyContract(hre, {
        address: resultImpl.address
    })

    console.log(`TraderJoeIntermediary implementation deployed at address: ${resultImpl.address} by a factory`);

    const exchange = await ethers.getContract("TraderJoeIntermediary");

    const calldata = web3Abi.encodeFunctionCall(
        TraderJoeIntermediaryArtifact.abi.find(method => method.name === 'initialize'),
        [traderJoeRouter, traderJoeSupportedAssets.map(asset => asset.assetAddress)]
    )

    let resultTup = await deploy('TraderJoeIntermediaryTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [exchange.address, admin, calldata],
    });

    await verifyContract(hre, {
        address: resultTup.address,
        contract: "contracts/proxies/tup/avalanche/TraderJoeIntermediaryTUP.sol:TraderJoeIntermediaryTUP",
        constructorArguments: [
            exchange.address,
            admin,
            calldata
        ]
    });

    console.log(`TraderJoeIntermediaryTUP deployed at address: ${resultTup.address} by a factory`);

};

module.exports.tags = ['avalanche'];
