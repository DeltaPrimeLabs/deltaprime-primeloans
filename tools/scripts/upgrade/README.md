NETWORK_NAME should be defined the same way as in `hardhat.config.ts`

####1. Create .secret-admin and .secret-deployer files in base directory

####2. Cherry-pick FUJI changes (if needed)

####3. Upgrade pool

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-pool.js").upgradePool("NETWORK_NAME", "CONTRACT_NAME")'

####5. Set access NFT for Pool

MacOS:

    node -r esm -e 'require("./tools/scripts/nft/nft.js").setDepositAccessNFT("NETWORK_NAME", "CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/nft/nft.js').setDepositAccessNFT('NETWORK_NAME', "CONTRACT_NAME")"

####6. Upgrade SmartLoansFactory

MacOS:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loans-factory.js').upgradeSmartLoansFactory('NETWORK_NAME', "CONTRACT_NAME")"

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loans-factory.js').upgradeSmartLoansFactory('NETWORK_NAME', "CONTRACT_NAME")"

####7. Set access NFT for SmartLoansFactory

MacOS:

    node -r esm -e 'require("./tools/scripts/nft/nft.js").setBorrowAccessNFT("NETWORK_NAME", "CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/nft/nft.js').setBorrowAccessNFT("NETWORK_NAME", "CONTRACT_NAME")"

####8. Deploy new Smart Loan implementation


MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loan.js").upgradeSmartLoan("NETWORK_NAME", "CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loan.js').upgradeSmartLoan('NETWORK_NAME', "CONTRACT_NAME")"
