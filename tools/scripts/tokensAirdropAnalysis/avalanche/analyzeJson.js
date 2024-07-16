const fs = require('fs');
const path = require('path');

// Function to read JSON from a file
function readJSONFromFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                return reject(err);
            }
            try {
                const jsonData = JSON.parse(data);
                resolve(jsonData);
            } catch (parseErr) {
                reject(parseErr);
            }
        });
    });
}

// Function to read the output file and calculate the sum of values
async function calculateSumOfValues(outputFilePath) {
    try {
        const data = await readJSONFromFile(outputFilePath);
        const sum = Object.values(data).reduce((acc, amount) => acc + amount, 0);
        console.log(`The sum of all values in the output file is: ${sum}`);
    } catch (error) {
        console.error('Error calculating the sum of values:', error);
    }
}

calculateSumOfValues(path.resolve(__dirname, 'sPrimeMintedDollarValuePerUser.json'));