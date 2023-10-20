const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const { getLoanStatusAtTimestamp } = require('./loan-history');

const serviceAccount = require('./delta-prime-db-firebase-adminsdk-nm0hk-12b5817179.json');
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

const uploadLoanStatuses = async (loanAddress, timestamps) => {
    let fileName = `results/${loanAddress}.json`;

    let loanStatuses = [];

    // const file = fs.readFileSync('timestamps.json', 'utf-8');
    // let timestampsData = JSON.parse(file);

    const loanHistoryRef = db
        .collection('loansHistory')
        .doc(loanAddress.toLowerCase())
        .collection('loanStatus');

    if (timestamps.length > 0) {

        await Promise.all(
            timestamps.map(async (timestamp) => {
                try {
                    const loanStatus = await getLoanStatusAtTimestamp(loanAddress, timestamp);

                    if (loanStatus) {

                        const status = await loanHistoryRef.doc(timestamp.toString()).get();

                        if (!status.exists) {
                            await loanHistoryRef.doc(timestamp.toString()).set({
                                totalValue: loanStatus.totalValue,
                                borrowed: loanStatus.borrowed,
                                collateral: loanStatus.totalValue - loanStatus.borrowed,
                                twv: loanStatus.twv,
                                health: loanStatus.health,
                                solvent: loanStatus.solvent === 1e-18,
                                timestamp: timestamp
                            });
                        }

                        // let status = {
                        //     a: 1
                        // }

                        loanStatuses.push({
                            totalValue: loanStatus.totalValue,
                            borrowed: loanStatus.borrowed,
                            collateral: loanStatus.totalValue - loanStatus.borrowed,
                            twv: loanStatus.twv,
                            health: loanStatus.health,
                            solvent: loanStatus.solvent === 1e-18,
                            timestamp: timestamp
                        });

                        return true;
                    } else {
                        return false;
                    }
                } catch(error) {
                    console.log(`fetching loan ${loanAddress} at ${timestamp} failed..`)
                }

            })
        );
    }

    let data = {};
    data.dataPoints = loanStatuses;
    data = JSON.stringify(data);

    fs.writeFileSync(fileName, data);
}


// const loanAddress = process.argv[2];

// uploadLoanStatuses(loanAddress);

module.exports = {
    uploadLoanStatuses
}