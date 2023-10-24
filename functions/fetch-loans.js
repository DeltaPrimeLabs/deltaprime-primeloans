const fs = require("fs");
const timestampData = require('./timestamps.json');

const file = fs.readFileSync('loan-addresses.json', "utf-8");

const data = JSON.parse(file);

const loanAddresses = data.addresses;
const totalLoans = loanAddresses.length;
console.log("..........starting...........")

const batchSize = 1;

const timestamps = timestampData.timestamps;
console.log(timestamps);


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
        const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);

        await Promise.all(
            batchLoanAddresses.map(async loanAddress => {
                const loanHistoryRef = db
                    .collection('loansHistory')
                    .doc(loanAddress.toLowerCase())
                    .collection('loanStatus');

                let fileName = `results/${loanAddress}.json`;
                let loanStatuses = [];

                await Promise.all(
                    timestamps.map(async (timestamp) => {
                        console.log(`fetching ${loanAddress} at ${timestamp}...`);
                        const loanStatus = await getLoanStatusAtTimestamp(loanAddress, timestamp);
                        console.log(loanStatus);
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

                                loanStatuses.push({
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

                        // console.log(loanStatus);
                    })
                )
                fs.writeFileSync(fileName, JSON.stringify({
                    dataPoints: loanStatuses
                }));
            })
        )
    }
}

fetchLoanHistory();
