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

// Function to write JSON to a file
function writeJSONToFile(filePath, data) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data, null, 2);
        fs.writeFile(filePath, jsonData, 'utf8', (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

// Function to sum amounts from multiple JSON objects
function sumAmounts(dataArray) {
    const result = {};
    for (const data of dataArray) {
        for (const [address, { amount }] of Object.entries(data)) {
            if (result[address]) {
                result[address] += amount;
            } else {
                result[address] = amount;
            }
        }
    }
    return result;
}

// Main function to read, sum, and write combined JSON data
async function combineJSONFiles(inputFilePaths, outputFilePath) {
    try {
        const dataArray = await Promise.all(inputFilePaths.map(readJSONFromFile));
        const combinedData = sumAmounts(dataArray);

        console.log(`Total $ sum: ${Object.values(combinedData).reduce((acc, amount) => acc + amount, 0)}`);

        await writeJSONToFile(outputFilePath, combinedData);
        console.log('File has been saved successfully.');
    } catch (error) {
        console.error('Error processing JSON files:', error);
    }
}

// Define input and output file paths
const inputFilePaths = [
    path.join(__dirname, 'unifiedFormat', 'loyaltyUnified.json'),
    path.join(__dirname, 'unifiedFormat', 'sPrimePartnerGuesserUnified.json'),
    path.join(__dirname, 'unifiedFormat', 'sPrimeUnified.json')
];
const outputFilePath = path.join(__dirname, 'combinedUnified', 'unifiedDistributionCombined.json');

// Execute the main function
combineJSONFiles(inputFilePaths, outputFilePath);
