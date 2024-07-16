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

// Function to process and combine JSON data
async function processAndCombineJSON(mintedFilePath, combinedFilePath, outputFilePath, maxDiffPercent) {
    try {
        const mintedDataRaw = await readJSONFromFile(mintedFilePath);
        const combinedDataRaw = await readJSONFromFile(combinedFilePath);

        const mintedData = {};
        for (const [address, amount] of Object.entries(mintedDataRaw)) {
            mintedData[address.toLowerCase()] = amount;
        }

        const combinedData = {};
        for (const [address, amountObj] of Object.entries(combinedDataRaw)) {
            combinedData[address.toLowerCase()] = amountObj;
        }

        const result = {};
        let skippedCount = 0;
        let savedCount = 0;
        let missingFromCombinedCount = 0;

        for (const [address, combinedAmountObj] of Object.entries(combinedData)) {
            const mintedAmount = mintedData[address] || 0;
            const diff = combinedAmountObj - mintedAmount;
            const diffPercent = ((combinedAmountObj - mintedAmount) / combinedAmountObj) * 100;

            if (diffPercent <= maxDiffPercent) {
                skippedCount++;
            } else {
                result[address] = diff;
                savedCount++;
            }
        }

        for (const address of Object.keys(mintedData)) {
            if (!combinedData[address]) {
                missingFromCombinedCount++;
            }
        }

        console.log(`Addresses in minted file: ${Object.keys(mintedData).length}`);
        console.log(`Addresses in combined file: ${Object.keys(combinedData).length}`);
        console.log(`Addresses missing from combined file: ${missingFromCombinedCount}`);
        console.log(`Addresses skipped due to %diff param: ${skippedCount}`);
        console.log(`Addresses saved to output file: ${savedCount}`);

        await writeJSONToFile(outputFilePath, result);
        console.log('File has been saved successfully.');
    } catch (error) {
        console.error('Error processing JSON files:', error);
    }
}

// Function to read the output file and calculate the sum of values
async function calculateSumOfValues(outputFilePath) {
    try {
        const data = await readJSONFromFile(outputFilePath);
        const sum = Object.values(data).reduce((acc, amount ) => acc + amount, 0);
        console.log(`The sum of all values in the output file is: ${sum}`);
    } catch (error) {
        console.error('Error calculating the sum of values:', error);
    }
}

// Define input and output file paths
const mintedFilePath = path.join(__dirname, 'sPrimeMintedDollarValuePerUser.json');
const combinedFilePath = path.join(__dirname, 'originalJsons', 'combinedUnified', 'unifiedDistributionCombined.json');
const outputFilePath = path.join(__dirname, 'leftToBeMinted', 'result.json');

// Define the max % diff parameter
const maxDiffPercent = 5; // You can change this value to the desired percentage

// Execute the main function
processAndCombineJSON(mintedFilePath, combinedFilePath, outputFilePath, maxDiffPercent)
    .then(() => calculateSumOfValues(outputFilePath))
    .catch(error => console.error('Error executing the script:', error));
