const fs = require('fs');

// Path to your JSON file
const filePath = './sPrimeAirdropDistributionHistoryAva.json';

// Read and parse the JSON file
fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading the file:', err);
        return;
    }

    try {
        const jsonArray = JSON.parse(data);

        let primeSum = 0;
        let avaxSum = 0;

        jsonArray.forEach(item => {
            primeSum += parseFloat(item.primeAmount);
            avaxSum += parseFloat(item.avaxAmount);
        });

        console.log('Total primeAmount:', primeSum);
        console.log('Total avaxAmount:', avaxSum);

    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
    }
});
