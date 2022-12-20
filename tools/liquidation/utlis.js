import {ethers} from "hardhat";

import CACHE_LAYER_URLS from '../../common/redstone-cache-layer-urls.json';
import {supportedAssetsAvax} from "../../common/addresses/avax/avalanche_supported_assets";
import {fromBytes32} from "../../test/_helpers";

const path = require("path");
const fs = require('fs');

const {getUrlForNetwork} = require("../scripts/helpers");
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const sdk = require("redstone-sdk");
const supportedTokensList = supportedAssetsAvax.map(asset => fromBytes32(asset.asset))

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]


export function getLiquidatorSigner(network) {
    // 0xe8D4E496ef28A0A6E0F2ce7805ff12482D8FdCE6
    const LIQUIDATOR_PRIVATE_KEY = fs.readFileSync(path.resolve(__dirname, "./.private-liquidator")).toString().trim();
    const RPC_URL = getUrlForNetwork(network);

    let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
    return (new ethers.Wallet(LIQUIDATOR_PRIVATE_KEY)).connect(provider);
}

export function getProvider(network) {
    const RPC_URL = getUrlForNetwork(network);

    return new ethers.providers.JsonRpcProvider(RPC_URL)
}

export async function wrapLoan(loanAddress, wallet) {
    let loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, wallet);

    loan = WrapperBuilder.wrap(loan).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: supportedTokensList,
            // @ts-ignore
            disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
    );

    return loan
}

export function wrapContractProd(contract) {
    return WrapperBuilder.wrap(contract).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: supportedTokensList,
        },
        CACHE_LAYER_URLS.urls
    );
}

export async function getSignedDataPackagesResponse() {
    return await sdk.requestDataPackages({
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: supportedTokensList,
        },
        CACHE_LAYER_URLS.urls
    );
}

export function getERC20Contract(address, wallet) {
    return new ethers.Contract(address, erc20ABI, wallet);
}