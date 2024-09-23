const fs = require('fs');

// Load the transfers from the JSON file
const transfers = JSON.parse(fs.readFileSync('transfers-to-0x8995d790169023Ee4fF67621948EBDFe7383f59e.json', 'utf8'));

// Price data object
const prices = {
    // AVAX
    '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7': [
        { timestamp: 1704931200, priceInDollars: 38.48 }, // 11.01.2024
        { timestamp: 1705536000, priceInDollars: 36.01 }, // 18.01.2024
        { timestamp: 1706140800, priceInDollars: 31.22 }, // 25.01.2024
        { timestamp: 1706745600, priceInDollars: 33.16 }, // 01.02.2024
        { timestamp: 1707350400, priceInDollars: 35.28 }, // 08.02.2024

        { timestamp: 1707951600, priceInDollars: 42.27 }, // 15.02.2024
        { timestamp: 1708560000, priceInDollars: 37.63 }, // 22.02.2024
        { timestamp: 1709164800, priceInDollars: 40.3 }, // 29.02.2024
        { timestamp: 1709769600, priceInDollars: 41.51 }, // 07.03.2024
        { timestamp: 1710374400, priceInDollars: 54.95 }, // 14.03.2024
        { timestamp: 1710979200, priceInDollars: 57.03 }, // 21.03.2024
        { timestamp: 1711584000, priceInDollars: 54.11 }, // 28.03.2024
        { timestamp: 1712188800, priceInDollars: 45.95 }, // 04.04.2024
        { timestamp: 1712793600, priceInDollars: 47.31 }, // 11.04.2024
        { timestamp: 1713398400, priceInDollars: 33.55 }, // 18.04.2024

        { timestamp: 1714003200, priceInDollars: 36.37 }, // 25.04.2024
        { timestamp: 1714608000, priceInDollars: 33.29 }, // 02.05.2024
        { timestamp: 1715212800, priceInDollars: 34.05 }, // 09.05.2024
        { timestamp: 1715817600, priceInDollars: 34.68 }, // 16.05.2024
        { timestamp: 1716422400, priceInDollars: 39.99 }, // 23.05.2024
        { timestamp: 1717027200, priceInDollars: 36.14 }, // 30.05.2024
        { timestamp: 1717632000, priceInDollars: 36.52 }, // 06.06.2024
        { timestamp: 1718236800, priceInDollars: 33.27 }, // 13.06.2024
        { timestamp: 1718841600, priceInDollars: 26.89 }, // 20.06.2024

        { timestamp: 1727109936, priceInDollars: 27.37 }, // today
    ],
    // USDC
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': [
        { timestamp: 1727109936, priceInDollars: 1.0 },
    ],
    // EUROC
    '0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD': [
        { timestamp: 1727109936, priceInDollars: 1.11 },
    ],
    // sAVAX
    '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE': [
        { timestamp: 1704931200, priceInDollars: 43.12 }, // 11.01.2024
        { timestamp: 1705536000, priceInDollars: 40.45 }, // 18.01.2024
        { timestamp: 1706140800, priceInDollars: 35.12 }, // 25.01.2024
        { timestamp: 1706745600, priceInDollars: 37.75 }, // 01.02.2024
        { timestamp: 1707350400, priceInDollars: 39.88 }, // 08.02.2024

        { timestamp: 1707951600, priceInDollars: 47.71 }, // 15.02.2024
        { timestamp: 1708560000, priceInDollars: 42.27 }, // 22.02.2024
        { timestamp: 1709164800, priceInDollars: 45.63 }, // 29.02.2024
        { timestamp: 1709769600, priceInDollars: 47.23 }, // 07.03.2024
        { timestamp: 1710374400, priceInDollars: 62.08 }, // 14.03.2024
        { timestamp: 1710979200, priceInDollars: 64.81 }, // 21.03.2024
        { timestamp: 1711584000, priceInDollars: 61.45 }, // 28.03.2024
        { timestamp: 1712188800, priceInDollars: 52.39 }, // 04.04.2024
        { timestamp: 1712793600, priceInDollars: 53.99 }, // 11.04.2024
        { timestamp: 1713398400, priceInDollars: 38.23 }, // 18.04.2024

        { timestamp: 1714003200, priceInDollars: 41.36 }, // 25.04.2024
        { timestamp: 1714608000, priceInDollars: 37.77 }, // 02.05.2024
        { timestamp: 1715212800, priceInDollars: 38.84 }, // 09.05.2024
        { timestamp: 1715817600, priceInDollars: 39.62 }, // 16.05.2024
        { timestamp: 1716422400, priceInDollars: 45.83 }, // 23.05.2024
        { timestamp: 1717027200, priceInDollars: 41.46 }, // 30.05.2024
        { timestamp: 1717632000, priceInDollars: 41.86 }, // 06.06.2024
        { timestamp: 1718236800, priceInDollars: 38.27 }, // 13.06.2024
        { timestamp: 1718841600, priceInDollars: 30.09 }, // 20.06.2024
        { timestamp: 1727109936, priceInDollars: 31.91 }, // today
    ],
    // ggAVAX
    '0xA25EaF2906FA1a3a13EdAc9B9657108Af7B703e3': [
        { timestamp: 1709769600, priceInDollars: 44.46 }, // 07.03.2024
        { timestamp: 1710374400, priceInDollars: 57.88 }, // 14.03.2024
        { timestamp: 1710979200, priceInDollars: 59.05 }, // 21.03.2024
        { timestamp: 1711584000, priceInDollars: 56.1 }, // 28.03.2024
        { timestamp: 1712188800, priceInDollars: 49.7 }, // 04.04.2024
        { timestamp: 1712793600, priceInDollars: 48.44 }, // 11.04.2024
        { timestamp: 1713398400, priceInDollars: 34.43 }, // 18.04.2024

        { timestamp: 1714003200, priceInDollars: 38.21 }, // 25.04.2024
        { timestamp: 1714608000, priceInDollars: 35.51 }, // 02.05.2024
        { timestamp: 1715212800, priceInDollars: 35.67 }, // 09.05.2024
        { timestamp: 1715817600, priceInDollars: 35.73 }, // 16.05.2024
        { timestamp: 1716422400, priceInDollars: 42.08 }, // 23.05.2024
        { timestamp: 1717027200, priceInDollars: 38.13 }, // 30.05.2024
        { timestamp: 1717632000, priceInDollars: 38.59 }, // 06.06.2024
        { timestamp: 1718236800, priceInDollars: 33.31 }, // 13.06.2024
        { timestamp: 1718841600, priceInDollars: 29.06 }, // 20.06.2024

        { timestamp: 1727109936, priceInDollars: 29.39 }, // today
    ],
    // yyAVAX
    '0xF7D9281e8e363584973F946201b82ba72C965D27': [
        { timestamp: 1704931200, priceInDollars: 38.81 }, // 11.01.2024
        { timestamp: 1705536000, priceInDollars: 40.00 }, // 18.01.2024
        { timestamp: 1706140800, priceInDollars: 34.61 }, // 25.01.2024
        { timestamp: 1706745600, priceInDollars: 39.53 }, // 01.02.2024
        { timestamp: 1707350400, priceInDollars: 38.58 }, // 08.02.2024

        { timestamp: 1707951600, priceInDollars: 46.32 }, // 15.02.2024
        { timestamp: 1708560000, priceInDollars: 42.07 }, // 22.02.2024
        { timestamp: 1709164800, priceInDollars: 44.03 }, // 29.02.2024
        { timestamp: 1709769600, priceInDollars: 45.13 }, // 07.03.2024
        { timestamp: 1710374400, priceInDollars: 57.86 }, // 14.03.2024
        { timestamp: 1710979200, priceInDollars: 63.99 }, // 21.03.2024
        { timestamp: 1711584000, priceInDollars: 62.89 }, // 28.03.2024
        { timestamp: 1712188800, priceInDollars: 54.02 }, // 04.04.2024
        { timestamp: 1712793600, priceInDollars: 52.86 }, // 11.04.2024
        { timestamp: 1713398400, priceInDollars: 37.16 }, // 18.04.2024

        { timestamp: 1714003200, priceInDollars: 41.35 }, // 25.04.2024
        { timestamp: 1714608000, priceInDollars: 39.04 }, // 02.05.2024
        { timestamp: 1715212800, priceInDollars: 39.07 }, // 09.05.2024
        { timestamp: 1715817600, priceInDollars: 35.54 }, // 16.05.2024
        { timestamp: 1716422400, priceInDollars: 45.83 }, // 23.05.2024
        { timestamp: 1717027200, priceInDollars: 41.78 }, // 30.05.2024
        { timestamp: 1717632000, priceInDollars: 40.86 }, // 06.06.2024
        { timestamp: 1718236800, priceInDollars: 41.21 }, // 13.06.2024
        { timestamp: 1718841600, priceInDollars: 29.45 }, // 20.06.2024

        { timestamp: 1727109936, priceInDollars: 31.11 }, // today
    ],
    // ETH
    '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab': [
        { timestamp: 1704931200, priceInDollars: 2584.17 }, // 11.01.2024
        { timestamp: 1705536000, priceInDollars: 2528.59 }, // 18.01.2024
        { timestamp: 1706140800, priceInDollars: 2233.97 }, // 25.01.2024
        { timestamp: 1706745600, priceInDollars: 2282.18 }, // 01.02.2024
        { timestamp: 1707350400, priceInDollars: 2424.08 }, // 08.02.2024

        { timestamp: 1707951600, priceInDollars: 2777.6 }, // 15.02.2024
        { timestamp: 1708560000, priceInDollars: 2969.6 }, // 22.02.2024
        { timestamp: 1709164800, priceInDollars: 3386.8 }, // 29.02.2024
        { timestamp: 1709769600, priceInDollars: 3818.31 }, // 07.03.2024
        { timestamp: 1710374400, priceInDollars: 4005.75 }, // 14.03.2024
        { timestamp: 1710979200, priceInDollars: 3514.02 }, // 21.03.2024
        { timestamp: 1711584000, priceInDollars: 3500.22 }, // 28.03.2024
        { timestamp: 1712188800, priceInDollars: 3311.5 }, // 04.04.2024
        { timestamp: 1712793600, priceInDollars: 3543.45 }, // 11.04.2024
        { timestamp: 1713398400, priceInDollars: 2984.71 }, // 18.04.2024

        { timestamp: 1714003200, priceInDollars: 3139.62 }, // 25.04.2024
        { timestamp: 1714608000, priceInDollars: 2969.79 }, // 02.05.2024
        { timestamp: 1715212800, priceInDollars: 2973.97 }, // 09.05.2024
        { timestamp: 1715817600, priceInDollars: 3036.01 }, // 16.05.2024
        { timestamp: 1716422400, priceInDollars: 3737.18 }, // 23.05.2024
        { timestamp: 1717027200, priceInDollars: 3763.36 }, // 30.05.2024
        { timestamp: 1717632000, priceInDollars: 3864.26 }, // 06.06.2024
        { timestamp: 1718236800, priceInDollars: 3559.73 }, // 13.06.2024
        { timestamp: 1718841600, priceInDollars: 3559.35 }, // 20.06.2024

        { timestamp: 1727109936, priceInDollars: 2669 }, // today
    ],
    // BTC
    '0x152b9d0FdC40C096757F570A51E494bd4b943E50': [
        { timestamp: 1704931200, priceInDollars: 46656.07 }, // 11.01.2024
        { timestamp: 1705536000, priceInDollars: 42742.31 }, // 18.01.2024
        { timestamp: 1706140800, priceInDollars: 40075.55 }, // 25.01.2024
        { timestamp: 1706745600, priceInDollars: 42596.76 }, // 01.02.2024
        { timestamp: 1707350400, priceInDollars: 44332.13 }, // 08.02.2024

        { timestamp: 1707951600, priceInDollars: 51836.78 }, // 15.02.2024
        { timestamp: 1708560000, priceInDollars: 51854.65 }, // 22.02.2024
        { timestamp: 1709164800, priceInDollars: 62499.18 }, // 29.02.2024
        { timestamp: 1709769600, priceInDollars: 66099.74 }, // 07.03.2024
        { timestamp: 1710374400, priceInDollars: 73079.37 }, // 14.03.2024
        { timestamp: 1710979200, priceInDollars: 67911.58 }, // 21.03.2024
        { timestamp: 1711584000, priceInDollars: 69452.77 }, // 28.03.2024
        { timestamp: 1712188800, priceInDollars: 65975.7 }, // 04.04.2024
        { timestamp: 1712793600, priceInDollars: 70575.73 }, // 11.04.2024
        { timestamp: 1713398400, priceInDollars: 61275.32 }, // 18.04.2024

        { timestamp: 1714003200, priceInDollars: 64275.02 }, // 25.04.2024
        { timestamp: 1714608000, priceInDollars: 58253.7 }, // 02.05.2024
        { timestamp: 1715212800, priceInDollars: 61191.2 }, // 09.05.2024
        { timestamp: 1715817600, priceInDollars: 66256.11 }, // 16.05.2024
        { timestamp: 1716422400, priceInDollars: 69121.3 }, // 23.05.2024
        { timestamp: 1717027200, priceInDollars: 67576.09 }, // 30.05.2024
        { timestamp: 1717632000, priceInDollars: 71082.84 }, // 06.06.2024
        { timestamp: 1718236800, priceInDollars: 68243.1 }, // 13.06.2024
        { timestamp: 1718841600, priceInDollars: 64960.3 }, // 20.06.2024

        { timestamp: 1727109936, priceInDollars: 63228 }, // today
    ],
    // USDT
    '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': [
        { timestamp: 1727109936, priceInDollars: 1.0 },
    ],
    // QI
    '0x8729438eb15e2c8b576fcc6aecda6a148776c0f5': [
        { timestamp: 1727109936, priceInDollars: 0.01488 },
    ],
    // PNG
    '0x60781C2586D68229fde47564546784ab3fACA982': [
        { timestamp: 1727109936, priceInDollars: 0.2677 },
    ],
    // JOE
    '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd': [
        { timestamp: 1727109936, priceInDollars: 0.3774 },
    ],
    // CAI
    '0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0': [
        { timestamp: 1727109936, priceInDollars: 146.97 },
    ],
};

// Function to find the closest price in time for a given token
function getClosestPrice(pricesArray, transferTimestamp) {
    let closest = pricesArray[0];
    let minDiff = Math.abs(transferTimestamp - closest.timestamp);

    for (let i = 1; i < pricesArray.length; i++) {
        const currentPrice = pricesArray[i];
        const diff = Math.abs(transferTimestamp - currentPrice.timestamp);

        if (diff < minDiff) {
            minDiff = diff;
            closest = currentPrice;
        }
    }

    return closest.priceInDollars;
}

// Main processing function
function processTransfers() {
    let totalUSDValue = 0;

    transfers.forEach((transfer) => {
        const { value, contractAddress, timeStamp } = transfer;
        const transferTimestamp = parseInt(timeStamp, 10);

        // Check if price data exists for the token
        if (!prices[contractAddress]) {
            console.warn(`No price data available for token: ${contractAddress}`);
            return;
        }

        const tokenPrices = prices[contractAddress];

        // Find the closest price
        const priceInDollars = getClosestPrice(tokenPrices, transferTimestamp);

        // Calculate USD value
        const usdValue = value * priceInDollars;

        totalUSDValue += usdValue;
    });

    console.log(`Total USD Value of Transfers: $${totalUSDValue.toFixed(2)}`);
}

// Run the processing function
processTransfers();