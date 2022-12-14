import {embedCommitHash} from "../../tools/scripts/embed-commit-hash";
import {pool, toWei} from "../../test/_helpers";
import web3Abi from "web3-eth-abi";
import TokenManagerArtifact from "../../artifacts/contracts/TokenManager.sol/TokenManager.json";
import {supportedAssetsAvax} from "../../common/addresses/avax/avalanche_supported_assets";

const {ethers} = require("hardhat");

const VectorUSDCStaking1 = '0x7a4a145bb3126fd29fe820c7cafd6a6Ff428621A';
const VectorWAVAXStaking1 = '0x4E42d1a0b83fA354882f19E89a316E00bc106a98';
const VectorSAVAXStaking1 = '0x822C11be60258D6Bf00C5B0907B2015633d11a62';

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
