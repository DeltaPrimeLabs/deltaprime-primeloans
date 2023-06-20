const redstone = require("redstone-api");
let fs = require('fs')

const symbol = 'GMX';
const milisecondsMeasured = 3600 * 1000 * 24 * 365; //time
const interval = 30 * 1000; // 30 seconds
const feedPackageInterval = 3600 * 1000; // 1 hour
const endTime = Date.now();

const startingPoints = [0, 10 * 1000, 20 * 1000]; // in miliseconds

const reportedDeviation = 0.05;

async function run() {
    await checkPrices();
}

async function checkPrices() {
    let startTime = Date.now() - milisecondsMeasured;
    let deviations = [];

    while(startTime < endTime) {
        for (let point of startingPoints) {
            let prices = (await redstone.getHistoricalPrice(symbol, {
                startDate: startTime + point,
                interval: interval,
                endDate: startTime + feedPackageInterval,
                provider: 'redstone'
            }));

            for (let i = 0; i < prices.length - 1; i++) {
                let priceChange = Math.abs((prices[i + 1].value - prices[i].value) /  prices[i].value);
                if (priceChange > reportedDeviation) {
                    console.log(`Timestamp: ${prices[i+1].timestamp} Deviation: ${(priceChange * 100).toFixed(3)}% Price1: ${prices[i].value.toFixed(4)} Price2: ${prices[i + 1].value.toFixed(4)}`)
                    deviations.push([prices[i+1].timestamp, priceChange, prices[i].value, prices[i + 1].value])
                }
            }
        }

        console.log('current timestamp: ', startTime);

        startTime += feedPackageInterval;
    }


    fs.writeFileSync(`${symbol}-${milisecondsMeasured}-${interval}.csv`, JSON.stringify(deviations), 'utf8');

}




run();