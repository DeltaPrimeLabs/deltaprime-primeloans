const ethers = require('ethers');
const FACTORY = require(`../../deployments/avalanche/SmartLoansFactory.json`);
const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";
const provider = new ethers.providers.JsonRpcProvider(jsonRPC);

const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


const payload = {
    "address": "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    "token_id": 9646
}

const headers = {
    'Content-Type': 'application/json',
    'X-Hexagate-Api-Key': 'Q62AF1AYQI69Axi/3pfMEw=='
}

const START_TIMESTAMP = 1688410287; // 1 month
// const START_TIMESTAMP = 1691003061; // 1 day

async function getEvents(address, events, minBlockTimestamp) {
    // let addressesString = '';
    //
    // addresses.forEach(
    //     (address, i) => {
    //         addressesString += 'addresses=' + address;
    //         if (i !== (addresses.length - 1)) {
    //             addressesString+= '&'
    //         }
    //     }
    // )

    // let eventsString = '';
    //
    // events.forEach(
    //     (event, i) => {
    //         eventsString += 'events=event ' + event;
    //         if (i !== (events.length - 1)) {
    //             eventsString+= '&'
    //         } else {
    //             eventsString+= ';'
    //         }
    //     }
    // )

    // const url = `https://api.hexagate.com/api/v1/avalanche/c-chain/concord/transactions/?${addressesString}&${eventsString}&reverse=true`
    const url = `https://api.hexagate.com/api/v1/avalanche/c-chain/concord/transactions/?addresses=${address}&reverse=true&max_records=1`

    const response = await fetch(url + '&address=0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D&token_id=9646', {
        method: "GET", // *GET, POST, PUT, DELETE, etc.
        headers: headers
    });


    const logs = await response.json(); // parses JSON response into native JavaScript objects

    console.log(logs);

    for (let log of logs) {
        console.log('log.block_timestamp: ', log.block_timestamp)
        console.log('minBlockTimestamp: ', minBlockTimestamp)
        console.log('log.block_timestamp > minBlockTimestamp: ', log.block_timestamp > minBlockTimestamp)
        if (log.block_timestamp > minBlockTimestamp) {
            return true;
        }
    }


    return false;
}

async function run() {
    // let event = 'Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)';
    //
    // let addresses =     [
    //     '0x702ef63881b5241ffb412199547bcd0c6910a970',
    //     '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf'
    // ];


    //TODO: not used
    let events = [
        'event Funded(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp)',
        'event Withdrawn(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp)',
        'event Borrowed(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp)',
        'event Repaid(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp)',
        'event DebtSwap(address indexed user, address indexed fromToken, address indexed toToken, uint256 repayAmount, uint256 borrowAmount, uint256 timestamp)',
        'event Swap(address indexed user, bytes32 indexed soldAsset, bytes32 indexed boughtAsset, uint256 maximumSold, uint256 minimumBought, uint256 timestamp)',
        'event AddLiquidity(address indexed user, address indexed lpToken, bytes32 firstAsset, bytes32 secondAsset, uint liquidity, uint firstAmount, uint secondAmount, uint256 timestamp)',
        'event RemoveLiquidity(address indexed user, address indexed lpToken, bytes32 firstAsset, bytes32 secondAsset, uint liquidity, uint firstAmount, uint secondAmount, uint256 timestamp)',
        'event GLPMint(address indexed user, bytes32 indexed tokenToMintWith, uint256 tokenToMintWithAmount, uint256 glpOutputAmount, uint256 timestamp)',

    'event GLPFeesClaim(address indexed user, uint256 wavaxAmountClaimed, uint256 timestamp)',
    'event GLPRedemption(address indexed user, bytes32 indexed redeemedToken, uint256 glpRedeemedAmount, uint256 redeemedTokenAmount, uint256 timestamp)',
    ];

    let factory = new ethers.Contract('0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D', FACTORY.abi, provider);

    const addresses = await factory.getAllLoans();
    console.log(addresses)

    let numberOfActive = 0;

    for (let address of addresses) {
        if (await getEvents(address, events, START_TIMESTAMP)) {
            numberOfActive++;
        }
    }

    console.log('Number of Active Users: ', numberOfActive)
}

run().then(
    console.log('elo')
)
