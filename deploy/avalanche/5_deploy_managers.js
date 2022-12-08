import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";

const {ethers} = require("hardhat");
import {asset, toBytes32, toWei} from "../../test/_helpers";
import web3Abi from "web3-eth-abi";
import TokenManagerArtifact
    from "../../artifacts/contracts/TokenManager.sol/TokenManager.json";
import {supportedAssetsAvax} from "../../common/addresses/avax/supported_token_manager";

const VectorUSDCStaking1 = '0x994F0e36ceB953105D05897537BF55d201245156';
const VectorWAVAXStaking1 = '0xff5386aF93cF4bD8d5AeCad6df7F4f4be381fD69';
const VectorSAVAXStaking1 = '0x812b7C3b5a9164270Dd8a0b3bc47550877AECdB1';

function pool(symbol, address) {
    return { asset: toBytes32(symbol), poolAddress: address }
}

module.exports = async ({
                            getNamedAccounts,
                            deployments
                        }) => {
    const {deploy} = deployments;
    const {deployer, admin} = await getNamedAccounts();

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
        args: [],
    });

    let tokenManager = await ethers.getContract("TokenManager");

    console.log(`Deployed tokenManager at address: ${tokenManager.address}`);

    const calldata = web3Abi.encodeFunctionCall(
        TokenManagerArtifact.abi.find(method => method.name === 'initialize'),
        [supportedAssetsAvax, lendingPools]
    )

    let deployedTokenManagerTUP = await deploy('TokenManagerTUP', {
        from: deployer,
        gasLimit: 8000000,
        args: [tokenManager.address, admin, calldata],
    });

    const tokenManagerTUP = await ethers.getContractAt("TokenManager", deployedTokenManagerTUP.address);

    //debt coverage for positions like Vector Finance
    await tokenManagerTUP.setDebtCoverage(VectorUSDCStaking1, toWei("0.8333333333333333"));
    await tokenManagerTUP.setDebtCoverage(VectorWAVAXStaking1, toWei("0.8333333333333333"));
    await tokenManagerTUP.setDebtCoverage(VectorSAVAXStaking1, toWei("0.8333333333333333"));

    console.log(`Deployed TokenManagerTUP at address: ${tokenManagerTUP.address}`);

};

module.exports.tags = ['avalanche'];
