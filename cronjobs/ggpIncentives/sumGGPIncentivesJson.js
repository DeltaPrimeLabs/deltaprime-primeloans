const fs = require('fs');
const path = require('path');

// Function to convert timestamp to human-readable format
function timestampToDate(timestamp) {
    const date = new Date(timestamp * 1000); // Multiply by 1000 to convert seconds to milliseconds
    return date.toUTCString(); // Returns date in UTC format
}

// Get all files in the current directory
const files = fs.readdirSync(__dirname);

// Filter files that match the pattern "ggpIncentives_<TIMESTAMP>.json"
const jsonFiles = files.filter(file => /^ggpIncentives_(\d+)\.json$/.test(file));

jsonFiles.forEach(file => {
    // Extract the timestamp from the filename
    const match = file.match(/^ggpIncentives_(\d+)\.json$/);
    if (match) {
        const timestamp = parseInt(match[1], 10);

        // Read and parse the JSON file
        const filePath = path.join(__dirname, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Sum the values in the JSON object
        let sum = 0;
        for (const key in data) {
            if (data.hasOwnProperty(key)) {
                sum += Number(data[key]);
            }
        }

        // Convert timestamp to human-readable format
        const humanReadableDate = timestampToDate(timestamp);

        // Console log the required information
        console.log(`Filename: ${file}`);
        console.log(`Timestamp: ${humanReadableDate}`);
        console.log(`Sum of values: ${sum}`);
        console.log('---------------------------------------');
    }
});
