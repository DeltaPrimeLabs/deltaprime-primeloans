const FACTORY = require('../../build/contracts/SmartLoansFactory.json');
const BORROW_NFT = require('../../build/contracts/BorrowAccessNFT.json');
const fs = require("fs");
const ethers = require("ethers");
const config = require("../network/config-local.json");


function initWallet() {
    const key = fs.readFileSync("./.secret").toString().trim();
    const provider = new ethers.providers.JsonRpcProvider();    // localhost
    // provider = new ethers.providers.JsonRpcProvider("https://207.154.255.139/");    // Digital Ocean forked node, leave blank for localhost

    return new ethers.Wallet(key, provider);
}

function initFactory() {
    const wallet = initWallet();

    return new ethers.Contract(FACTORY.networks[config["network-id"]].address, FACTORY.abi, wallet);
}

module.exports.setAccessNFT = function setAccessNFT(address) {
    initFactory()
        .setAccessNFT(address)
            .then(
                (re) => {
                    console.log(re)
                }
            );
    }



module.exports.addNFTs = function addNFTs(address) {
    const wallet = initWallet();
    const uris = fs.readFileSync("./tools/nft/uris.txt").toString().split("\n");

    const contract = new ethers.Contract(address, BORROW_NFT.abi, wallet);

    contract.addAvailableUri(uris).then(
        () => {
            console.log("URIs successfully added!")
        }
    )
}

module.exports.getNFTsLeft = function getNFTsLeft(address) {
    const wallet = initWallet();

    const contract = new ethers.Contract(address, BORROW_NFT.abi, wallet);

    contract.getAvailableUrisCount().then(
        (resp) => {
            console.log(resp)
        }
    )
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