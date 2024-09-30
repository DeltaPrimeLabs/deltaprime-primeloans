const fs = require('fs');
const path = require('path');

// Path to the folder containing the JSON files
const folderPath = './historicalJsons/10-09-2024to27-09-2024';

// Object to hold the sum for each address
const addressSums = {};

// Total sum of all values
let totalSum = 0;

// Read all JSON files in the directory
fs.readdir(folderPath, (err, files) => {
    if (err) {
        console.error('Error reading directory:', err);
        return;
    }

    // Filter only JSON files
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Process each JSON file
    jsonFiles.forEach((file, index) => {
        const filePath = path.join(folderPath, file);

        // Read and parse the JSON file
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Loop through each address and sum values
        for (const [address, value] of Object.entries(data)) {
            if (!addressSums[address]) {
                addressSums[address] = 0;
            }
            addressSums[address] += value;
            totalSum += value;
        }

        // After all files are processed
        if (index === jsonFiles.length - 1) {
            // Write the final output to a JSON file
            const outputFilePath = path.join(folderPath, 'final_sums.json');
            fs.writeFileSync(outputFilePath, JSON.stringify(addressSums, null, 2));

            // Log the sum of all values in the final JSON
            console.log('Total sum of all values:', totalSum);
            console.log('Final sums written to:', outputFilePath);
        }
    });
});
