import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
import TRUSTED_SIGNERS from '../../common/redstone-trusted-signers.json';

const {ethers} = require("hardhat");
import addresses from "../../common/addresses/avax/token_addresses.json";
import {Asset, toBytes32} from "../../test/_helpers";

const supportedAssets = [
    asset('AVAX'),
    asset('USDC'),
    asset('BTC'),
    asset('ETH'),
    asset('USDT'),
    asset('sAVAX'),
    asset('QI', 0),
    asset('PNG', 0),
    asset('PTP', 0),
    asset('PNG_AVAX_USDC_LP'),
    asset('PNG_AVAX_USDT_LP'),
    asset('PNG_AVAX_ETH_LP'),
    asset('TJ_AVAX_USDC_LP'),
    asset('TJ_AVAX_USDT_LP'),
    asset('TJ_AVAX_ETH_LP'),
    asset('TJ_AVAX_BTC_LP'),
    asset('TJ_AVAX_sAVAX_LP'),
    asset('YY_AAVE_AVAX'),
    asset('YY_PTP_sAVAX'),
    asset('YY_PNG_AVAX_USDC_LP'),
    asset('YY_PNG_AVAX_ETH_LP'),
    asset('YY_TJ_AVAX_sAVAX_LP'),
    asset('YY_TJ_AVAX_USDC_LP'),
    asset('YY_TJ_AVAX_ETH_LP'),
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

    await deploy('TokenManager', {
        from: deployer,
        gasLimit: 8000000,
        args:
            [
                supportedAssets,
                lendingPools
            ],
    });

    let tokenManager = await ethers.getContract("TokenManager");

    console.log(`Deployed tokenManager at address: ${tokenManager.address}`);

    let tokenManagerTUP = await deploy('TokenManagerTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [tokenManager.address, admin, calldata],
    });

    // await verifyContract(hre, {
    //     address: tokenManager.address
    // });

    console.log(`Deployed TokenManagerTUP at address: ${tokenManagerTUP.address}`);

};

module.exports.tags = ['avalanche'];
