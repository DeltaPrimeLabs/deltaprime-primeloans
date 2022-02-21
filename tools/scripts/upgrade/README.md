NETWORK_NAME should be defined the same way as in `hardhat.config.ts`

####1. Create `.secret-admin` and `.secret-deployer` files in base directory

####2. Deploy main contracts

    npx hardhat deploy --network NETWORK_NAME --tags init

####3. Deploy upgraded contracts

Location is `deploy/upgrade` directory. For Competition contracts tag is `competition`

    npx hardhat deploy --network NETWORK_NAME --tags TAG_NAME

####4. Upgrade pool

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-pool.js").upgradePool("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-pool.js').upgradePool('NETWORK_NAME', "UPGRADE_CONTRACT_NAME')"

####5. Set access NFT for Pool

MacOS:

    node -r esm -e 'require("./tools/scripts/nft/nft.js").setAccessNFT("NETWORK_NAME", "NFT_CONTRACT_NAME", "PoolTUP", "PoolWithAccessNFT")'

Windows:

    node -r esm -e "require('./tools/scripts/nft/nft.js').setAccessNFT('NETWORK_NAME', 'NFT_CONTRACT_NAME', 'PoolTUP', 'PoolWithAccessNFT')"

####6. Upgrade SmartLoansFactory

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loans-factory.js").upgradeSmartLoansFactory("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loans-factory.js').upgradeSmartLoansFactory('NETWORK_NAME', 'UPGRADE_CONTRACT_NAME')"

####7. Set access NFT for SmartLoansFactory

MacOS:

    node -r esm -e 'require("./tools/scripts/nft/nft.js").setAccessNFT("NETWORK_NAME", "NFT_CONTRACT_NAME", "SmartLoansFactoryTUP", "SmartLoansFactoryWithAccessNFT")'

Windows:

    node -r esm -e "require('./tools/scripts/nft/nft.js').setAccessNFT('NETWORK_NAME', 'NFT_CONTRACT_NAME', 'SmartLoansFactoryTUP', 'SmartLoansFactoryWithAccessNFT')"

####8. Deploy new Smart Loan implementation

MacOS:

    node -r esm -e 'require("./tools/scripts/upgrade/upgrade-smart-loan.js").upgradeSmartLoan("NETWORK_NAME", "UPGRADE_CONTRACT_NAME")'

Windows:

    node -r esm -e "require('./tools/scripts/upgrade/upgrade-smart-loan.js').upgradeSmartLoan('NETWORK_NAME', 'UPGRADE_CONTRACT_NAME')"
