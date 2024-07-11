const { ethers } = require('ethers');

// Initialize Ethers.js with Avalanche provider
const provider = new ethers.providers.JsonRpcProvider('https://nd-033-589-713.p2pify.com/d41fdf9956747a40bae4edec06ad4ab9/ext/bc/C/rpc');

// Function to get the closest block number for a specified timestamp
const getClosestBlockNumber = async (timestamp) => {
    try {
        // Convert timestamp to date object if it's not already
        if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            timestamp = new Date(timestamp * 1000);
        }

        // Function to get block details by block number
        const getBlock = async (blockNumber) => {
            return await provider.getBlock(blockNumber);
        };

        // Function to perform binary search to find the closest block
        const binarySearchClosestBlock = async (startBlock, endBlock) => {
            while (startBlock <= endBlock) {
                const midBlock = Math.floor((startBlock + endBlock) / 2);
                const block = await getBlock(midBlock);

                const blockTimestamp = block.timestamp * 1000; // Convert to milliseconds

                if (blockTimestamp === timestamp.getTime()) {
                    return midBlock;
                } else if (blockTimestamp < timestamp.getTime()) {
                    startBlock = midBlock + 1;
                } else {
                    endBlock = midBlock - 1;
                }
            }
            // After binary search, startBlock is the smallest block with timestamp greater than the input timestamp
            return startBlock;
        };

        // Get the latest block number
        const latestBlockNumber = await provider.getBlockNumber();
        const latestBlock = await getBlock(latestBlockNumber);
        const earliestBlockNumber = 0; // Assuming block 0 is the earliest block

        // Perform binary search
        const closestBlockNumber = await binarySearchClosestBlock(earliestBlockNumber, latestBlockNumber);

        return closestBlockNumber;
    } catch (error) {
        console.error('Error fetching the closest block number:', error);
    }
};

// Example usage
const timestamp = 1720687560; // Replace with your desired timestamp in seconds
getClosestBlockNumber(timestamp).then((blockNumber) => {
    console.log('Closest block number:', blockNumber);
});
