const { ethers } = require('ethers');
const fs = require('fs');

// ARB token contract address
const arbTokenAddr = '0x912CE59144191C1204E64559FE8253a0e49E6548';

// Distribution wallet address
const distributionWallet = '0x628e67dB27245847e9D7fB2A5f785e68B0DC19a0';

// Define RPC URL for Arbitrum
const rpcUrl = 'https://nd-820-127-885.p2pify.com/eb20dbbf452bafebd4ea76aa69c6629e';

function getProvider() {
    return new ethers.providers.JsonRpcProvider(rpcUrl);
}

async function checkDistribution(fromBlock, toBlock) {
    const provider = getProvider();
    const arbTokenAbi = [
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "from",
                    "type": "address"
                },
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "to",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "value",
                    "type": "uint256"
                }
            ],
            "name": "Transfer",
            "type": "event"
        }
    ];

    const arbTokenContract = new ethers.Contract(arbTokenAddr, arbTokenAbi, provider);

    // Load distribution data from JSON file
    const distributionData = JSON.parse(fs.readFileSync("distribution_history_pa.json", "utf8"));

    console.log(distributionData)

    // Create a map for quick lookup of expected token amounts by address
    const distributionMap = new Map(
        Object.keys(distributionData).map(key => [key.toLowerCase(), distributionData[key]])
    );

    // Process blocks in chunks of 10,000
    const chunkSize = 10000;
    let currentFromBlock = fromBlock;
    const maxBlock = toBlock === "latest" ? await provider.getBlockNumber() : toBlock;

    while (currentFromBlock <= maxBlock) {
        const currentToBlock = Math.min(currentFromBlock + chunkSize - 1, maxBlock);

        console.log(`Fetching transfer events from ${distributionWallet} from block ${currentFromBlock} to ${currentToBlock}...`);
        const transferEvents = await arbTokenContract.queryFilter(
            arbTokenContract.filters.Transfer(distributionWallet, null),
            currentFromBlock,
            currentToBlock
        );

        // Process the transfer events
        transferEvents.forEach(event => {
            const recipientAddress = event.args.to.toLowerCase();
            const amountTransferred = parseFloat(ethers.utils.formatEther(event.args.value.toString())).toString();

            // Check if the recipient is in the distribution map and if the amount matches
            if (distributionMap.has(recipientAddress)) {
                const expectedAmount = distributionMap.get(recipientAddress);

                if (amountTransferred === expectedAmount) {
                    // Remove the successfully processed entry
                    distributionMap.delete(recipientAddress);
                } else {
                    console.log(`${typeof amountTransferred} ${typeof expectedAmount}`)
                    console.log(`Amount mismatch for ${recipientAddress}: Expected ${expectedAmount}, Transferred ${amountTransferred}`);
                }
            }
        });

        currentFromBlock = currentToBlock + 1;
    }

    // Check for any addresses that were not funded
    if (distributionMap.size > 0) {
        console.log("The following accounts were not funded correctly:");
        distributionMap.forEach((expectedAmount, userAddress) => {
            console.log(`Address: ${userAddress}, Expected Tokens: ${expectedAmount}`);
        });
    } else {
        console.log("All accounts have been funded correctly.");
    }
}

// Read command-line arguments for fromBlock and toBlock
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node checkDistributions.js <fromBlock> <toBlock>");
    process.exit(1);
}

const fromBlock = parseInt(args[0], 10);
const toBlock = args[1].toLowerCase() === "latest" ? "latest" : parseInt(args[1], 10);

// Execute the check for the Arbitrum chain
checkDistribution(fromBlock, toBlock);
