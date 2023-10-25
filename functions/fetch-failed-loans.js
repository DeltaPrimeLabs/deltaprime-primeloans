const fs = require("fs");

const file = fs.readFileSync('failed-loans.json', "utf-8");

const data = JSON.parse(file);

const failedLoans = data.failed;
const totalLoans = Object.keys(failedLoans).length;
console.log("..........starting...........")

const batchSize = 1;

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const { getLoanStatusAtTimestamp } = require('./loan-history');

const serviceAccount = require('./delta-prime-db-firebase-adminsdk-nm0hk-12b5817179.json');
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function fetchLoanHistory () {

    for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
        console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans - 1 : (i + 1) * batchSize - 1} loans`);
        const batchLoanAddresses = Object.keys(failedLoans).slice(i * batchSize, (i + 1) * batchSize);

        await Promise.all(
            batchLoanAddresses.map(async loanAddress => {
                const timestamps = failedLoans[loanAddress];
                const loanHistoryRef = db
                    .collection('loansHistory')
                    .doc(loanAddress.toLowerCase())
                    .collection('loanStatus');

                let fileName = `results/${loanAddress}.json`;

                await Promise.all(
                    timestamps.map(async (timestamp) => {
                        const status = await loanHistoryRef.doc(timestamp.toString()).get();

                        if (!status.exists) {
                            console.log(`fetching ${loanAddress} at ${timestamp}...`);
                            const loanStatus = await getLoanStatusAtTimestamp(loanAddress, timestamp);
                            console.log(loanStatus);
                            if (loanStatus) {
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
                        }
                    })
                )
            })
        )
    }
}

fetchLoanHistory();
