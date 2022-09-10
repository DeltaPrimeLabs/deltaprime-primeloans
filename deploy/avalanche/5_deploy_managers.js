import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import addresses from "../../common/addresses/avax/token_addresses.json";
import {toBytes32} from "../../test/_helpers";
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
    asset('SAVAX')
]

function asset(symbol) {
    return { asset: toBytes32(symbol), assetAddress: addresses[symbol] }
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

    //TODO: update signers
    let redstoneConfigManager = await deploy('RedstoneConfigManager', {
        from: deployer,
        gasLimit: 8000000,
        args:
        [
            [
                "0xFE71e9691B9524BC932C23d0EeD5c9CE41161884",
                "0x1cd8f9627a2838a7dae6b98cf71c08b9cbf5174a",
                "0x981bda8276ae93f567922497153de7a5683708d3",
                "0x3befdd935b50f172e696a5187dbacfef0d208e48",
                "0xc1d5b940659e57b7bdf8870cdfc43f41ca699460",
                "0xbc5a06815ee80de7d20071703c1f1b8fc511c7d4",
                "0x496f4e8ac11076350a59b88d2ad62bc20d410ea3",
                "0xe9fa2869c5f6fc3a0933981825564fd90573a86d",
                "0xdf6b1ca313bee470d0142279791fa760abf5c537",
            ]
        ]
    });

    await verifyContract(hre, {
        address: redstoneConfigManager.address
    });

    console.log(`Deployed redstoneConfigManager at address: ${redstoneConfigManager.address}`);


};

module.exports.tags = ['avalanche'];
