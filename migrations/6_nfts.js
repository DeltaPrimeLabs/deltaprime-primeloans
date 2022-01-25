var BorrowAccessNFT = artifacts.require("./BorrowAccessNFT.sol");
var SmartLoansFactory = artifacts.require("./SmartLoansFactory.sol");

module.exports = async function(deployer) {
    await deployer.deploy(BorrowAccessNFT);

    const nft = await BorrowAccessNFT.deployed();
    nft.addAvailableUri(
        [
            'ar://iRiH720RYtuKBQnD5gpUm7rYqw5tgx3PIGTc-RDFxAI',
            'ar://HTumRDFS2aok4xJnMypUdOWEXIAf2Kp_h6qrDNYfMaU',
            'ar://YXMdoVn5-T0EE9bPJWpQaDnnnUyWTIb7mRNFM48j9k0'
        ]
    )

    let factory = await SmartLoansFactory.deployed();
    await factory.setAccessNFT(nft.address)
};
