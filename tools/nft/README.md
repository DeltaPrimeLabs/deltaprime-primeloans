All scripts must be run from the project base directory!

##Deploy Borrow NFT Access contract
Remember about `.secret` in this directory

`npx hardhat run --network localhost tools/nft/deploy-borrow-nft.js`


##Set Borrow NFT Access address in SmartLoansFactory
NFT address as string in double quotes
`node -e 'require("./tools/nft/nft").setAccessNFT("NFT_ADDRESS_HERE_AS_STRING")'`

##Upload NFTs to Arweave and generate list of metadata addresses
This script will **CLEAR** `uris.txt` file, try to upload **ALL FILES** (regardless the format or size)
 from `./images` directory to Arweave with metadata defined in `metadata.json`, and **ADD** them to `uris.txt` 

`node ./tools/nft/arweave-upload`

##Add available URIs to NFTAccess contract
This method will take all addresses from `uris.txt` file and add them to NFT Access contract.
NFT address as string in double quotes

`node -e 'require("./tools/nft/nft").addNFTs("NFT_ADDRESS_HERE_AS_STRING")'`





