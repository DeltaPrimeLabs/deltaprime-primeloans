NETWORK_NAME should be defined the same way as in `hardhat.config.ts`

####1. Create .secret-admin and .secret-deployer files in base directory

####2. Cherry-pick FUJI changes (if needed)

####3. Deploy contracts

    truffle compile --all

    npx truffle migrate --network NETWORK_NAME

####4. Deploy NFT access contracts

Change contract name in `./tools/scripts/deploy.js`

    npx hardhat run --network NETWORK_NAME ./tools/scripts/deploy.js

####5. Deploy and upgrade pool

Change contract name in `./tools/scripts/deploy.js`

    truffle compile --all

    npx hardhat run --network NETWORK_NAME ./tools/scripts/deploy.js

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-pool.js").upgradePool("NETWORK_NAME", "POOL_ADDRESS")'

####5. Set access NFT for Pool

MacOS:

    node -r esm -e 'require("./tools/scripts/nft/nft.js").setDepositAccessNFT("NETWORK_NAME", "DEPOSIT_NFT_ADDRESS")'

Windows:

    node -r esm -e "require('./tools/scripts/nft/nft.js').setDepositAccessNFT('NETWORK_NAME', 'DEPOSIT_NFT_ADDRESS')"

####6. Deploy and upgrade SmartLoansFactory

Change contract name in `./tools/scripts/deploy.js`

    truffle compile --all

    npx hardhat run --network NETWORK_NAME ./tools/scripts/deploy.js

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loans-factory.js").upgradeSmartLoansFactory("NETWORK_NAME", "FACTORY_ADDRESS")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loans-factory.js').upgradeSmartLoansFactory('NETWORK_NAME', 'FACTORY_ADDRESS')"

####7. Set access NFT for SmartLoansFactory

MacOS:

    node -r esm -e 'require("./tools/scripts/nft/nft.js").setBorrowAccessNFT("NETWORK_NAME", "BORROW_NFT_ADDRESS")'

Windows:

    node -r esm -e "require('./tools/scripts/nft/nft.js').setBorrowAccessNFT("NETWORK_NAME", 'BORROW_NFT_ADDRESS')"

####8. Deploy new Smart Loan implementation

Change contract name in `./tools/scripts/deploy.js`

    truffle compile --all

    npx hardhat run --network NETWORK_NAME ./tools/scripts/deploy.js

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loan.js").upgradeSmartLoan("NETWORK_NAME", "LOAN_IMPL_ADDRESS")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loan.js').upgradeSmartLoan('NETWORK_NAME', 'LOAN_IMPL_ADDRESS')"
