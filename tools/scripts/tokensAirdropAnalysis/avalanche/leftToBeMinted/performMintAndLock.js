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
                "internalType": "uint256",
                "name": "activeIdDesired",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "idSlippage",
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
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            // @ts-ignore
            disablePayloadsDryRun: false
        },
        CACHE_LAYER_URLS.urls
    );
}

async function performAirdrop(data) {
    let wallet = initWallet('avalanche');
    let provider = getProvider();

    let totalWavaxAmount = 1585.711914731453;
    let totalPrimeAmount = 35886.99408493223;
    const activeIdDesired = 8387997;
    const idSlippage = 10;
    const sumOfDollarValuesAcrossAllUsers = Object.values(data).reduce((acc, currentValue) => acc + currentValue, 0);
    console.log(`Total dollar value: ${sumOfDollarValuesAcrossAllUsers}`)

    let sPrimeContractAddress = '0xd38C5cEca20Fb43503E108ed8d4CaCA5B57E730E';
    let sPrimeContract = new ethers.Contract(sPrimeContractAddress, sPrimeAirdropABI, wallet);
    sPrimeContract = wrapContract(sPrimeContract, wallet);

    let distributionHistoryFileName = 'sPrimeAirdropDistributionHistoryAva.json';
    let distributionHistory = readJSON(distributionHistoryFileName);
    let alreadyAirdroppedUsers = distributionHistory.map(entry => entry.address);

    let failedUsersFileName = 'sPrimeAirdropFailedUsersAva.json';
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
        let wavaxAmount = (totalWavaxAmount * userFraction).toFixed(18);

        console.log(`Minting sPrime with ${primeAmount} Prime and ${wavaxAmount} WAVAX for ${userAddress}`);

        try {
            let primeInWei = ethers.utils.parseUnits(primeAmount, 18);
            let wavaxInWei = ethers.utils.parseUnits(wavaxAmount, 18);

            let txHash = (await sPrimeContract.mintForUserAndLock(userAddress, percentForLocks, lockPeriods, primeInWei, wavaxInWei, activeIdDesired, idSlippage, {gasLimit: 10000000})).hash;
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
            writeJSON(failedUsersFileName, failedUsers);
        }

    }
}

// TODO: Approve the sPrime to use WAVAX and PRIME before running the script
const result = performAirdrop(outputJsonData);
