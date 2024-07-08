const fs = require('fs');

// Read the output JSON data from a file
const rawData = fs.readFileSync('sPrimeLoyaltyAvalanche.json');
const outputJsonData = JSON.parse(rawData);

function analyzeSPrimeSums(data) {
    let totalSPrimeSum = 0;

    Object.keys(data).forEach( key => {
        totalSPrimeSum += data[key].amount;
    });

    return { totalSPrimeSum, entryCount: Object.keys(data).length };
}

const result = analyzeSPrimeSums(outputJsonData);
console.log('Total sPrimeSum:', result.totalSPrimeSum);
console.log('Number of entries:', result.entryCount);
