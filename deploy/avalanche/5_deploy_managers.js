import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
import TRUSTED_SIGNERS from '../../common/redstone-trusted-signers.json';

const {ethers} = require("hardhat");
import addresses from "../../common/addresses/avax/token_addresses.json";
import {Asset, toBytes32} from "../../test/_helpers";
import verifyContract from "../../tools/scripts/verify-contract";
import hre from "hardhat";

const supportedAssets = [
    asset('AVAX'),
    asset('USDC'),
    asset('BTC'),
    asset('ETH'),
    asset('USDT'),
    asset('LINK'),
    asset('QI'),
    asset('sAVAX'),
    asset('PNG_AVAX_USDC_LP'),
    asset('TJ_AVAX_USDC_LP'),
    asset('YYAV3SA1'),
    asset('SAV2'),
    asset('YY_TJ_AVAX_USDC_LP'),
]

function asset(symbol) {
    return new Asset(toBytes32(symbol), addresses[symbol], 0.8333333333333333)
}

function pool(symbol, address) {
    return { asset: toBytes32(symbol), poolAddress: address }
}

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer} = await getNamedAccounts();

    embedCommitHash('RedstoneConfigManager');
    embedCommitHash('TokenManager');

    const wavaxPoolTUP = await ethers.getContract("WavaxPoolTUP");
    const usdcPoolTUP = await ethers.getContract("UsdcPoolTUP");

    let lendingPools = [
        pool("AVAX", wavaxPoolTUP.address),
        pool("USDC", usdcPoolTUP.address)
    ];

    let tokenManager = await deploy('TokenManager', {
        from: deployer,
        gasLimit: 8000000,
        args:
            [
                supportedAssets,
                lendingPools
            ],
    });

    await verifyContract(hre, {
        address: tokenManager.address
    });

    console.log(`Deployed tokenManager at address: ${tokenManager.address}`);

    //TODO: check before the production deploy
    let redstoneConfigManager = await deploy('RedstoneConfigManager', {
        from: deployer,
        gasLimit: 8000000,
        args:
        [
            TRUSTED_SIGNERS.signers
        ]
    });

    await verifyContract(hre, {
        address: redstoneConfigManager.address
    });

    console.log(`Deployed redstoneConfigManager at address: ${redstoneConfigManager.address}`);


};

module.exports.tags = ['avalanche'];
