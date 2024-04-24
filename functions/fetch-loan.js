const fs = require('fs');

const { getLoanStatusAtTimestamp } = require('./loan-history');

const uploadLoanStatuses = async (loanAddress) => {
    let fileName = `results/${loanAddress}.json`;

    let loanStatuses = [];

    const file = fs.readFileSync('timestamps.json', 'utf-8');
    let timestampsData = JSON.parse(file);

    const timestamps = timestampsData.timestamps;

    console.log(timestamps);

    if (timestamps.length > 0) {

        await Promise.all(
            timestamps.map(async (timestamp) => {
                const loanStatus = await getLoanStatusAtTimestamp(loanAddress, timestamp);

                if (loanStatus) {
                    let status = {
                        totalValue: loanStatus.totalValue,
                        borrowed: loanStatus.borrowed,
                        collateral: loanStatus.totalValue - loanStatus.borrowed,
                        twv: loanStatus.twv,
                        health: loanStatus.health,
                        solvent: loanStatus.solvent === 1e-18,
                        timestamp: timestamp
                    }

                    // let status = {
                    //     a: 1
                    // }

                    loanStatuses.push(status);

                    return true;
                } else {
                    return false;
                }

            })
        );
    }

    let data = {};
    data.dataPoints = loanStatuses;
    data = JSON.stringify(data);

    fs.writeFileSync(fileName, data);
}


const loanAddress = process.argv[2];

uploadLoanStatuses(loanAddress);