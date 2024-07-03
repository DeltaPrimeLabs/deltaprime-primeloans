const fs = require('fs');
const ethers = require("ethers");
const {getUrlForNetwork} = require("../helpers");

// Read the output JSON data from a file
const rawData = fs.readFileSync('sPrimeSumResultAva16Spreadsheet.json');
const outputJsonData = JSON.parse(rawData);

const sPrimeAirdropABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "internalType": "uint256[]",
                "name": "percentForLocks",
                "type": "uint256[]"
            },
            {
                "internalType": "uint256[]",
                "name": "lockPeriods",
                "type": "uint256[]"
            },
            {
                "internalType": "uint256",
                "name": "amountX",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "amountY",
                "type": "uint256"
            }
        ],
        "name": "mintForUserAndLock",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "user",
                "type": "address"
            }
        ],
        "name": "balanceOf",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

const percentForLocks = [100]

let lockPeriods = [1]

function getProvider(){
    return new ethers.providers.JsonRpcProvider("https://avax.nirvanalabs.xyz/avalanche_aws/ext/bc/C/rpc?apikey=284d7cde-5c20-46a9-abee-2e3932cdb771");
}

function initWallet(networkName) {
    const key = fs.readFileSync(`../../../.secrets/${networkName}/deployer`).toString().trim();
    console.log(getUrlForNetwork(networkName));
    const provider = getProvider();

    return new ethers.Wallet(key, provider);
}

function writeJSON(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf8');
}

function readJSON(filename) {
    const data = fs.readFileSync(filename, 'utf8');
    return JSON.parse(data);
}

async function performAirdrop(data) {
    let wallet = initWallet('avalanche');
    let provider = getProvider();

    let sPrimeContractAddress = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
    const sPrimeContract = new ethers.Contract(sPrimeContractAddress, sPrimeAirdropABI, wallet);

    let distributionHistoryFileName = 'sPrimeAirdropDistributionHistoryAva.json';
    let distributionHistory = readJSON(distributionHistoryFileName);
    let alreadyAirdroppedUsers = distributionHistory.map(entry => entry.address);

    let skippedUsersFileName = 'sPrimeAirdropSkippedUsersAva.json';
    let skippedUsers = readJSON(skippedUsersFileName);
    let alreadySkippedUsers = skippedUsers.map(entry => entry.address);

    let failedUsersFileName = 'sPrimeAirdropFailedUsersAva.json';
    let failedUsers = readJSON(failedUsersFileName);

    let totalAvaxAmount = data.reduce((acc, entry) => acc + entry.avaxAmount, 0);
    let totalPrimeAmount = data.reduce((acc, entry) => acc + entry.primeAmount, 0);
    console.log(`Total avax amount: ${totalAvaxAmount}, total prime amount: ${totalPrimeAmount}`);

    for(let i = 0; i < data.length; i++) {
        console.log(`Processing entry ${i+1} of ${data.length}`);
        let entry = data[i];

        if(alreadyAirdroppedUsers.includes(entry.address)) {
            console.log(`User ${entry.address} already airdropped, skipping`);
            continue;
        }

        if(alreadySkippedUsers.includes(entry.address)) {
            console.log(`User ${entry.address} already skipped (has sPrime), skipping`);
            continue;
        }

        let airdropAddress = entry.address;

        let userBalance = 0;
        try {
            userBalance = await sPrimeContract.balanceOf(airdropAddress);
        } catch (error) {
            console.log(`Error getting balance for ${airdropAddress} at index ${i}`);
            writeJSON(distributionHistoryFileName, distributionHistory);
            writeJSON(skippedUsersFileName, skippedUsers);
            writeJSON(failedUsersFileName, failedUsers);
        }

        if(userBalance > 0) {
            console.log(`User already has ${userBalance} SPrime, skipping and saving to ${skippedUsersFileName}`);
            skippedUsers.push({"address": airdropAddress, "balance": userBalance});
            writeJSON(skippedUsersFileName, skippedUsers);
        } else {
            let primeAmount = (entry.primeAmount).toFixed(18);
            let avaxAmount = (entry.avaxAmount).toFixed(18);

            console.log(`Minting sPrime with ${primeAmount} Prime and ${avaxAmount} AVAX for ${airdropAddress}`);
            try {
                let primeInWei = ethers.utils.parseUnits(primeAmount, 18);
                let avaxInWei = ethers.utils.parseUnits(avaxAmount, 18);

                let txHash = (await sPrimeContract.mintForUserAndLock(airdropAddress, percentForLocks, lockPeriods, primeInWei, avaxInWei, {gasLimit: 6000000})).hash;
                const transaction = await provider.waitForTransaction(txHash, 1, 120_000);
                if (transaction.status === 0) {
                    failedUsers.push({"address": airdropAddress, "sPrimeSum": sPrimeDollarValue, "primeAmount": primeAmount, "wethAmount": wethAmount, "txHash": txHash});
                    writeJSON(failedUsersFileName, failedUsers);
                    throw new Error(`mintForUserAndLock failed for ${airdropAddress} (tx hash: ${txHash})`);
                } else {
                    console.log(`Transaction ${txHash} success`);
                    distributionHistory.push({"address": airdropAddress, "primeAmount": primeAmount, "avaxAmount": avaxAmount, "txHash": txHash});
                    writeJSON(distributionHistoryFileName, distributionHistory);
                }
            } catch (error) {
                console.log(`Error minting SPrime for ${airdropAddress} at index ${i}`);
                writeJSON(distributionHistoryFileName, distributionHistory);
                writeJSON(skippedUsersFileName, skippedUsers);
                writeJSON(failedUsersFileName, failedUsers);
            }
        }
    }
}

// TODO: Approve the sPrime to use AVAX and PRIME before running the script
const result = performAirdrop(outputJsonData);
