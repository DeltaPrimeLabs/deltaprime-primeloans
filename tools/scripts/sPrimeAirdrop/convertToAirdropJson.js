const fs = require('fs');

// Read JSON data from a file
const rawData = fs.readFileSync('sprime-arb.json');
const jsonData = JSON.parse(rawData);

// Function to sum sPrime values for each unique id and generate result JSON
function generateSPrimeSumById(data) {
    const sPrimeSums = {};
    const keys = ["BTC", "ARB", "DAI", "USDC", "ETH"];

    data.forEach(entry => {
        const currentId = entry.id;
        if (!sPrimeSums[currentId]) {
            sPrimeSums[currentId] = 0;
        }

        keys.forEach(key => {
            if (entry[key] && 'sPrime' in entry[key]) {
                sPrimeSums[currentId] += parseFloat(entry[key].sPrime);
            }
        });
    });

    const result = Object.keys(sPrimeSums).map(id => ({ address: id, sPrimeSum: sPrimeSums[id] }));
    return result;
}

const result = generateSPrimeSumById(jsonData);
console.log('Result:', JSON.stringify(result, null, 2));

// Optionally write the result to a file
fs.writeFileSync('sPrimeSumResultArb.json', JSON.stringify(result, null, 2));
