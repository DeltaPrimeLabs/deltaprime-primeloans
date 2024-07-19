const fs = require('fs');
const ethers = require("ethers");
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const CACHE_LAYER_URLS = require("../../../../../common/redstone-cache-layer-urls.json");

// Read the output JSON data from a file
const rawData = fs.readFileSync('result.json');
const outputJsonData = JSON.parse(rawData);

const sPrimeAirdropABI = [
    {
        "inputs": [
            {
                "internalType": "uint256[]",
                "name": "ids",
                "type": "uint256[]"
            },
            {
                "internalType": "uint256[]",
                "name": "amounts",
                "type": "uint256[]"
            },
            {
                "internalType": "uint256",
                "name": "activeIdDesired",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "idSlippage",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "swapSlippage",
                "type": "uint256"
            }
        ],
        "name": "migrateLiquidity",
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
            },
            {
                "internalType": "int24",
                "name": "tickDesired",
                "type": "int24"
            },
            {
                "internalType": "int24",
                "name": "tickSlippage",
                "type": "int24"
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
    const key = fs.readFileSync(`../../../../../.secrets/${networkName}/deployer`).toString().trim();
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

function wrapContract(contract, performer) {
    return WrapperBuilder.wrap(contract.connect(performer)).usingDataService(
        {
            dataServiceId: "redstone-arbitrum-prod",
            uniqueSignersCount: 3,
            // @ts-ignore
            disablePayloadsDryRun: false
        },
        CACHE_LAYER_URLS.urls
    );
}

async function performAirdrop(data) {
    let wallet = initWallet('arbitrum');
    let provider = getProvider();

    let totalWethAmount = 4.575433664526127;
    let totalPrimeAmount = 12068.564102557997;
    const tickDesired = -78762;
    const tickSlippage = 100;
    const sumOfDollarValuesAcrossAllUsers = Object.values(data).reduce((acc, currentValue) => acc + currentValue, 0);
    console.log(`Total dollar value: ${sumOfDollarValuesAcrossAllUsers}`)

    let sPrimeContractAddress = '0x04d36A9aAD2072C69E4B0Cb2A403D8a893064945';
    let sPrimeContract = new ethers.Contract(sPrimeContractAddress, sPrimeAirdropABI, wallet);
    sPrimeContract = wrapContract(sPrimeContract, wallet);

    let distributionHistoryFileName = 'sPrimeAirdropDistributionHistoryArb.json';
    let distributionHistory = readJSON(distributionHistoryFileName);
    let alreadyAirdroppedUsers = distributionHistory.map(entry => entry.address);

    let failedUsersFileName = 'sPrimeAirdropFailedUsersArb.json';
    let failedUsers = readJSON(failedUsersFileName);

    let counter = 0;
    for(const userAddress of Object.keys(data)) {
        counter++;
        console.log(`Processing entry ${counter} of ${Object.keys(data).length}`);
        let userAmount = data[userAddress];
        console.log(`Processing user ${userAddress} with amount ${userAmount}`)

        let sPrimeDollarValue = userAmount;
        let userFraction = sPrimeDollarValue / sumOfDollarValuesAcrossAllUsers;

        console.log(`User fraction: ${userFraction}`)


        if(alreadyAirdroppedUsers.includes(userAddress)) {
            console.log(`User ${userAddress} already airdropped, skipping`);
            continue;
        }

        let primeAmount = (totalPrimeAmount * userFraction).toFixed(18);
        let wethAmount = (totalWethAmount * userFraction).toFixed(18);

        console.log(`Minting sPrime with ${primeAmount} Prime and ${wethAmount} WETH for ${userAddress}`);

        try {
            let primeInWei = ethers.utils.parseUnits(primeAmount, 18);
            let wethInWei = ethers.utils.parseUnits(wethAmount, 18);

            let txHash = (await sPrimeContract.mintForUserAndLock(userAddress, percentForLocks, lockPeriods, primeInWei, wethInWei, tickDesired, tickSlippage, {gasLimit: 10000000})).hash;
            const transaction = await provider.waitForTransaction(txHash, 1, 120_000);
            if (transaction.status === 0) {
                failedUsers.push({"address": userAddress, "sPrimeSum": sPrimeDollarValue, "primeAmount": primeAmount, "wethAmount": wethAmount, "txHash": txHash});
                writeJSON(failedUsersFileName, failedUsers);
                throw new Error(`mintForUserAndLock failed for ${userAddress} (tx hash: ${txHash})`);
            } else {
                console.log(`Transaction ${txHash} success`);
                distributionHistory.push({"address": userAddress, "primeAmount": primeAmount, "wethAmount": wethAmount, "txHash": txHash});
                writeJSON(distributionHistoryFileName, distributionHistory);
            }
        } catch (error) {
            console.log(`Error minting SPrime for ${userAddress} at counter ${counter}`);
            console.log(error);
            writeJSON(distributionHistoryFileName, distributionHistory);
            writeJSON(failedUsersFileName, failedUsers);
        }

    }
}

// TODO: Approve the sPrime to use WETH and PRIME before running the script
const result = performAirdrop(outputJsonData);
