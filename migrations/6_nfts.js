var BorrowAccessNFT = artifacts.require("./BorrowAccessNFT.sol");

module.exports = function(deployer) {
    deployer.deploy(BorrowAccessNFT)
        .then(function() {
            return BorrowAccessNFT.deployed();
        }).then(function(nft) {
        nft.addAvailableUri(
            [
                'ar://2ZR_QRXRHN2UFV1KgEhVx9eha7cVxvglN_4P0WcBcRE',
                'ar://2ZR_QRXRHN2UFV1KgEhVx9eha7cVxvglN_4P0WcBcRE',
                'ar://2ZR_QRXRHN2UFV1KgEhVx9eha7cVxvglN_4P0WcBcRE'
            ]
        )
    })

};
