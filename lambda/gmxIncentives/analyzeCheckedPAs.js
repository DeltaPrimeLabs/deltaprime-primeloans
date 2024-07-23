const fs = require('fs');

function readJSON(filename) {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
}

function analyzeJson() {
    const checkedPAs = readJSON("checkedPAs.json");

    const hrThreshold = 1.02;
    const totalValueThreshold = 1000;

    const pas = []
    const totalValues = []
    const hrs = []
    // count how many pas have "hr" parameter < 1.0
    let count = 0;
    for (let pa of checkedPAs) {
        if (pa.hr <= hrThreshold && pa.totalValue >= totalValueThreshold) {
            pas.push(pa.address);
            totalValues.push(pa.totalValue);
            hrs.push(pa.hr);
            count++;
        }
    }
    console.log(`Number of PAs with hr < ${hrThreshold}: ${count} and totalValue >= $${totalValueThreshold}`)

    for(let i = 0; i < pas.length; i++) {
        console.log(`Address: ${pas[i]}, totalValue: ${totalValues[i]}, hr: ${hrs[i]}`)
    }
}

analyzeJson()