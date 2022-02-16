import {getChainIdForNetwork, getUrlForNetwork} from "../helpers";

const FACTORY_NFT = require('../../../build/contracts/SmartLoansFactoryWithAccessNFT.json');
const POOL_NFT = require('../../../build/contracts/PoolWithAccessNFT.json');
const FACTORY_TUP = require('../../../build/contracts/SmartLoansFactoryTUP.json');
const POOL_TUP = require('../../../build/contracts/PoolTUP.json');
const BORROW_NFT = require('../../../build/contracts/BorrowAccessNFT.json');
const DEPOSIT_NFT = require('../../../build/contracts/DepositAccessNFT.json');
const fs = require("fs");
const ethers = require("ethers");

function initWallet(networkName) {
    const key = fs.readFileSync("./.secret-deployer").toString().trim();
    const provider = new ethers.providers.JsonRpcProvider(getUrlForNetwork(networkName));

    return new ethers.Wallet(key, provider);
}

function initContract(networkName, proxy, contractWithNFT) {
    const wallet = initWallet(networkName);

    return new ethers.Contract(proxy.networks[getChainIdForNetwork(networkName)].address, contractWithNFT.abi, wallet);
}

function setNft(networkName, nftAddress, proxy, contractWithNFT) {
    initContract(networkName, proxy, contractWithNFT)
        .setAccessNFT(nftAddress)
        .then(
            (re) => {
                console.log(re)
            }
        );
}

function populateNftUris(networkName, address, nftContract) {
    const wallet = initWallet(networkName);
    const uris = fs.readFileSync("./tools/scripts/nft/uris.txt").toString().split("\n");

    const contract = new ethers.Contract(address, nftContract.abi, wallet);

    contract.addAvailableUri(uris).then(
        () => {
            console.log("URIs successfully added!")
        }
    )
}

function getNFTsLeft(address, nftContract) {
    const wallet = initWallet();

    const contract = new ethers.Contract(address, nftContract.abi, wallet);

    contract.getAvailableUrisCount().then(
        (resp) => {
            console.log(resp)
        }
    )
}

/// EXPORTED FUNCTIONS

module.exports.setBorrowAccessNFT = function setBorrowAccessNFT(networkName, address) {
    setNft(networkName, address, FACTORY_TUP, FACTORY_NFT);
}

module.exports.setDepositAccessNFT = function setDepositAccessNFT(networkName, address) {
    setNft(networkName, address, POOL_TUP, POOL_NFT);
}

module.exports.populateDepositNftUris = function populateDepositNftUris(networkName, address) {
    populateNftUris(networkName, address, DEPOSIT_NFT);
}

module.exports.populateBorrowNftUris = function populateBorrowNftUris(networkName,address) {
    populateNftUris(networkName, address, BORROW_NFT);
}

module.exports.getBorrowNFTsLeft = function getBorrowNFTsLeft(address) {
    getNFTsLeft(address, BORROW_NFT);
}

module.exports.getDepositNFTsLeft = function getDepositNFTsLeft(address) {
    getNFTsLeft(address, DEPOSIT_NFT);
}

module.exports.getNFT = function getNFT(address, id) {
    const wallet = initWallet();

    const contract = new ethers.Contract(address, BORROW_NFT.abi, wallet);

    contract.getAvailableUri(id).then(
        (resp) => {
            console.log(resp)
        }
    )
}