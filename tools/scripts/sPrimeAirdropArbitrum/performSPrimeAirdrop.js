const fs = require('fs');
const ethers = require("ethers");
const {getUrlForNetwork} = require("../helpers");

// Read the output JSON data from a file
const rawData = fs.readFileSync('sPrimeSumResultArb.json');
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
    return new ethers.providers.JsonRpcProvider("https://nd-762-566-527.p2pify.com/4514bd12de6723b94346752e90e95cf4");
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
    let wallet = initWallet('arbitrum');
    let provider = getProvider();

    let sPrimeContractAddress = '0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945';
    const sPrimeContract = new ethers.Contract(sPrimeContractAddress, sPrimeAirdropABI, wallet);

    let distributionHistoryFileName = 'sPrimeAirdropDistributionHistoryArb.json';
    let distributionHistory = readJSON(distributionHistoryFileName);
    let alreadyAirdroppedUsers = distributionHistory.map(entry => entry.address);

    let skippedUsersFileName = 'sPrimeAirdropSkippedUsersArb.json';
    let skippedUsers = readJSON(skippedUsersFileName);
    let alreadySkippedUsers = skippedUsers.map(entry => entry.address);

    let sumOfSPrime = data.reduce((acc, entry) => acc + entry.sPrimeSum, 0);
    console.log(`Sum of sPrime dollar value from all users: ${sumOfSPrime}`)

    // TODO: REPLACE THESE VALUES WITH THE ACTUAL AMOUNTS
    let totalWethAmount = 1931.212765267121480852;
    let totalPrimeAmount = 42967.31429;
    console.log(`Total weth amount: ${totalWethAmount}, total prime amount: ${totalPrimeAmount}`);

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
        let sPrimeDollarValue = entry.sPrimeSum;
        let userFraction = sPrimeDollarValue / sumOfSPrime;

        let userBalance = 0;
        try {
            userBalance = await sPrimeContract.balanceOf(airdropAddress);
        } catch (error) {
            console.log(`Error getting balance for ${airdropAddress} at index ${i}`);
            writeJSON(distributionHistoryFileName, distributionHistory);
            writeJSON(skippedUsersFileName, skippedUsers);
        }

        if(userBalance > 0) {
            console.log(`User already has ${userBalance} SPrime, skipping and saving to ${skippedUsersFileName}`);
            skippedUsers.push({"address": airdropAddress, "balance": userBalance});
            writeJSON(skippedUsersFileName, skippedUsers);
        } else {
            let primeAmount = (totalPrimeAmount * userFraction).toFixed(18);
            let wethAmount = (totalWethAmount * userFraction).toFixed(18);

            console.log(`Minting sPrime with ${primeAmount} Prime and ${wethAmount} WETH for ${airdropAddress}`);
            try {
                let primeInWei = ethers.utils.parseUnits(primeAmount, 18);
                let wethInWei = ethers.utils.parseUnits(wethAmount, 18);

                // TODO: Check USED gas limit
                let txHash = (await sPrimeContract.mintForUserAndLock(airdropAddress, percentForLocks, lockPeriods, primeInWei, wethInWei)).hash;
                const transaction = await provider.waitForTransaction(txHash, 1, 120_000);
                if (transaction.status === 0) {
                    throw new Error(`mintForUserAndLock failed for ${airdropAddress} (tx hash: ${txHash})`);
                } else {
                    console.log(`Transaction ${txHash} success`);
                    distributionHistory.push({"address": airdropAddress, "sPrimeSum": sPrimeDollarValue, "primeAmount": primeAmount, "wethAmount": wethAmount, "txHash": txHash});
                    writeJSON(distributionHistoryFileName, distributionHistory);
                }
            } catch (error) {
                console.log(`Error minting SPrime for ${airdropAddress} at index ${i}`);
                writeJSON(distributionHistoryFileName, distributionHistory);
                writeJSON(skippedUsersFileName, skippedUsers);
            }
        }
    }
}

// TODO: Approve the sPrime to use WETH and PRIME before running the script
const result = performAirdrop(outputJsonData);
