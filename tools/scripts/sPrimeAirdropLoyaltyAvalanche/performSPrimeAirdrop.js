const fs = require('fs');
const ethers = require("ethers");
const {getUrlForNetwork} = require("../helpers");

// Read the output JSON data from a file
const rawData = fs.readFileSync('sPrimeLoyaltyAvalanche.json');
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

const percentForLocks = [
    4, 4, 4, 4, 4,
    4, 4, 4, 4, 4,
    4, 4, 4, 4, 4,
    4, 4, 4, 4, 4,
    4, 4, 4, 4, 4
]

let lockPeriods = [
    622080, 1244160, 1866240, 2488320, 3110400,
    3732480, 4354560, 4976640, 5598720, 6220800,
    6842880, 7464960, 8087040, 8709120, 9331200,
    9953280, 10575360, 11197440, 11819520, 12441600,
    13063680, 13685760, 14307840, 14929920, 15552000
]

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

async function performAirdropForFailedUsers(data) {
    let wallet = initWallet('avalanche');
    let provider = getProvider();

    const sumOfAmountsExcludedAndIncluded = 146509.1181645026;
    let totalWavaxAmount = 2466.483471;
    let totalPrimeAmount = 55812.9974;

    let sPrimeContractAddress = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
    const sPrimeContract = new ethers.Contract(sPrimeContractAddress, sPrimeAirdropABI, wallet);

    let failedUsersFileName = 'sPrimeAirdropFailedUsersAva.json';
    let failedUsers = readJSON(failedUsersFileName);

    let distributionHistoryFileName = 'sPrimeAirdropDistributionHistoryAva.json';
    let distributionHistory = readJSON(distributionHistoryFileName);
    let alreadyAirdroppedUsers = distributionHistory.map(entry => entry.address);

    let skippedUsersFileName = 'sPrimeAirdropSkippedUsersAva.json';
    let skippedUsers = readJSON(skippedUsersFileName);
    let alreadySkippedUsers = skippedUsers.map(entry => entry.address);

    let counter = 0;
    for(const failedEntry of failedUsers) {
        counter++;
        console.log(`Processing entry ${counter} of ${failedUsers.length}`);

        let userAddress = failedEntry.address;
        console.log(`Processing user ${userAddress} with sPrimeSum ${failedEntry.sPrimeSum} primeAmount: ${failedEntry.primeAmount}, wavaxAmount: ${failedEntry.wavaxAmount}`)

        if(alreadyAirdroppedUsers.includes(failedEntry.address)) {
            console.log(`User ${failedEntry.address} already airdropped, skipping`);
            continue;
        }

        if(alreadySkippedUsers.includes(failedEntry.address)) {
            console.log(`User ${failedEntry.address} already skipped (has sPrime), skipping`);
            continue;
        }

        let userBalance = 0;
        try {
            userBalance = await sPrimeContract.balanceOf(userAddress);
        } catch (error) {
            console.log(`Error getting balance for ${userAddress} at counter ${counter}`);
            failedUsers.push({"address": userAddress});
            writeJSON(distributionHistoryFileName, distributionHistory);
            writeJSON(skippedUsersFileName, skippedUsers);
            writeJSON(failedUsersFileName, failedUsers);
        }

        if(userBalance > 0) {
            console.log(`User already has ${userBalance} SPrime, skipping and saving to ${skippedUsersFileName}`);
            skippedUsers.push({"address": userAddress, "balance": userBalance});
            writeJSON(skippedUsersFileName, skippedUsers);
        } else {
            let primeAmount;
            let wavaxAmount;

            if(failedEntry.primeAmount === undefined || failedEntry.wavaxAmount === undefined) {
                let userSPrimeDollarValue = data[userAddress].amount;
                let userFraction = userSPrimeDollarValue / sumOfAmountsExcludedAndIncluded;
                primeAmount = (totalPrimeAmount * userFraction).toFixed(18);
                wavaxAmount = (totalWavaxAmount * userFraction).toFixed(18);
            } else {
                primeAmount = Number(failedEntry.primeAmount).toFixed(18);
                wavaxAmount = Number(failedEntry.wavaxAmount).toFixed(18);
            }

            console.log(`Minting sPrime with ${primeAmount} Prime and ${wavaxAmount} WAVAX for ${userAddress}`);

            try {
                let primeInWei = ethers.utils.parseUnits(primeAmount, 18);
                let wavaxInWei = ethers.utils.parseUnits(wavaxAmount, 18);

                let txHash = (await sPrimeContract.mintForUserAndLock(userAddress, percentForLocks, lockPeriods, primeInWei, wavaxInWei, {gasLimit: 10000000})).hash;
                const transaction = await provider.waitForTransaction(txHash, 1, 120_000);
                if (transaction.status === 0) {
                    failedUsers.push({"address": userAddress, "sPrimeSum": sPrimeDollarValue, "primeAmount": primeAmount, "wavaxAmount": wavaxAmount, "txHash": txHash});
                    writeJSON(failedUsersFileName, failedUsers);
                    throw new Error(`mintForUserAndLock failed for ${userAddress} (tx hash: ${txHash})`);
                } else {
                    console.log(`Transaction ${txHash} success`);
                    distributionHistory.push({"address": userAddress, "primeAmount": primeAmount, "wavaxAmount": wavaxAmount, "txHash": txHash});
                    writeJSON(distributionHistoryFileName, distributionHistory);
                }
            } catch (error) {
                console.log(`Error minting SPrime for ${userAddress} at counter ${counter}`);
                writeJSON(distributionHistoryFileName, distributionHistory);
                writeJSON(skippedUsersFileName, skippedUsers);
                writeJSON(failedUsersFileName, failedUsers);
                throw error;
            }
        }
    }

}

async function performAirdrop(data) {
    let wallet = initWallet('avalanche');
    let provider = getProvider();

    let totalWavaxAmount = 2466.483471;
    let totalPrimeAmount = 55812.9974;
    const sumOfAmountsExcludedAndIncluded = 146509.1181645026;

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

    let counter = 0;
    for(const userAddress of Object.keys(data)) {
        counter++;
        console.log(`Processing entry ${counter} of ${Object.keys(data).length}`);
        let entry = data[userAddress];
        console.log(`Processing user ${userAddress} with amount ${entry.amount}`)

        let sPrimeDollarValue = entry.amount;
        let userFraction = sPrimeDollarValue / sumOfAmountsExcludedAndIncluded;

        console.log(`User fraction: ${userFraction}`)

        if(alreadyAirdroppedUsers.includes(entry.address)) {
            console.log(`User ${entry.address} already airdropped, skipping`);
            continue;
        }

        if(alreadySkippedUsers.includes(entry.address)) {
            console.log(`User ${entry.address} already skipped (has sPrime), skipping`);
            continue;
        }

        let airdropAddress = userAddress;

        let userBalance = 0;
        try {
            userBalance = await sPrimeContract.balanceOf(airdropAddress);
        } catch (error) {
            console.log(`Error getting balance for ${airdropAddress} at counter ${counter}`);
            failedUsers.push({"address": airdropAddress});
            writeJSON(distributionHistoryFileName, distributionHistory);
            writeJSON(skippedUsersFileName, skippedUsers);
            writeJSON(failedUsersFileName, failedUsers);
        }

        if(userBalance > 0) {
            console.log(`User already has ${userBalance} SPrime, skipping and saving to ${skippedUsersFileName}`);
            skippedUsers.push({"address": airdropAddress, "balance": userBalance});
            writeJSON(skippedUsersFileName, skippedUsers);
        } else {
            let primeAmount = (totalPrimeAmount * userFraction).toFixed(18);
            let wavaxAmount = (totalWavaxAmount * userFraction).toFixed(18);

            console.log(`Minting sPrime with ${primeAmount} Prime and ${wavaxAmount} WAVAX for ${airdropAddress}`);

            try {
                let primeInWei = ethers.utils.parseUnits(primeAmount, 18);
                let wavaxInWei = ethers.utils.parseUnits(wavaxAmount, 18);

                let txHash = (await sPrimeContract.mintForUserAndLock(airdropAddress, percentForLocks, lockPeriods, primeInWei, wavaxInWei, {gasLimit: 6000000})).hash;
                const transaction = await provider.waitForTransaction(txHash, 1, 120_000);
                if (transaction.status === 0) {
                    failedUsers.push({"address": airdropAddress, "sPrimeSum": sPrimeDollarValue, "primeAmount": primeAmount, "wavaxAmount": wavaxAmount, "txHash": txHash});
                    writeJSON(failedUsersFileName, failedUsers);
                    throw new Error(`mintForUserAndLock failed for ${airdropAddress} (tx hash: ${txHash})`);
                } else {
                    console.log(`Transaction ${txHash} success`);
                    distributionHistory.push({"address": airdropAddress, "primeAmount": primeAmount, "wavaxAmount": wavaxAmount, "txHash": txHash});
                    writeJSON(distributionHistoryFileName, distributionHistory);
                }
            } catch (error) {
                console.log(`Error minting SPrime for ${airdropAddress} at counter ${counter}`);
                writeJSON(distributionHistoryFileName, distributionHistory);
                writeJSON(skippedUsersFileName, skippedUsers);
                writeJSON(failedUsersFileName, failedUsers);
                throw error;
            }
        }
    }
}

// TODO: Approve the sPrime to use WAVAX and PRIME before running the script
// const result = performAirdrop(outputJsonData);
const result = performAirdropForFailedUsers(outputJsonData);
