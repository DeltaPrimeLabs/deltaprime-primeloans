const fs = require('fs');

// Read the output JSON data from a file
const rawData = fs.readFileSync('sPrimeSumResultArb.json');
const outputJsonData = JSON.parse(rawData);

function analyzeSPrimeSums(data) {
    let totalSPrimeSum = 0;

    data.forEach(entry => {
        totalSPrimeSum += entry.sPrimeSum;
    });

    return { totalSPrimeSum, entryCount: data.length };
}

const result = analyzeSPrimeSums(outputJsonData);
console.log('Total sPrimeSum:', result.totalSPrimeSum);
console.log('Number of entries:', result.entryCount);
