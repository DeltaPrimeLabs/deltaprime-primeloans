const { ethers } = require("hardhat");

async function main() {
    // We get the name of contract to deploy
    const name = "BorrowAccessNFT";
    const Contract = await ethers.getContractFactory(name);
    const contract = await Contract.deploy();

    console.log("Contract deployed to:", contract.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });