const fs = require('fs');

// Replace 'data.json' with the path to your JSON file
const jsonData = JSON.parse(fs.readFileSync('ggpIncentives_1726733026.json', 'utf8'));

let sum = 0;

for (const key in jsonData) {
    if (jsonData.hasOwnProperty(key)) {
        sum += jsonData[key];
    }
}

console.log('Sum of values:', sum);