import {wrapContract} from "./check-loan-data";

const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);

const fs = require("fs");

const gql = require("graphql-tag");
const fetch = require("node-fetch");
const ethers = require("ethers");
const EthDater = require("ethereum-block-by-date");
const addresses = require("../../common/addresses/avalanche/token_addresses.json");
export const fromWei = val => parseFloat(ethers.utils.formatUnits(val));
export const formatUnits = ethers.utils.formatUnits;
const STABILITY_POOL_ADDRESS = "0x8Ac151296Ae72a8AeE01ECB33cd8Ad9842F2704f";
const FEES_TREASURY_ADDRESS = "0x18C244c62372dF1b933CD455769f9B4DdB820F0C";
const CHAIN = "avalanche";
const jsonRPC = "https://avalanche-mainnet.core.chainstack.com/ext/bc/C/rpc/0968db18a01a90bac990ff00df6f7da1";

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

const tokenAddressesJson = JSON.parse(fs.readFileSync(`common/addresses/${CHAIN.toLowerCase()}/token_addresses.json`));

const POOL_TUP_ADDRESSES = [
    "0x2323dAC85C6Ab9bd6a8B5Fb75B0581E31232d12b",
    "0xD26E504fc642B96751fD55D3E68AF295806542f5",
    "0xd222e10D7Fe6B7f9608F14A8B5Cf703c74eFBcA1",
    "0xD7fEB276ba254cD9b34804A986CE9a8C3E359148",
    "0x475589b0Ed87591A893Df42EC6076d2499bB63d0",
];

const DECIMALS = {
    "AVAX": 18,
    "USDC": 6,
    "sAVAX": 18,
    "ggAVAX": 18,
    "yyAVAX": 18,
    "ETH": 18,
    "BTC": 8,
    "USDT": 6,
    "EUROC": 6,
    "QI": 18,
    "PNG": 18,
    "PTP": 18,
    "GMX": 18,
    "JOE": 18,
    "SOL": 18,
    "GM_BTC_BTCb_USDC": 18,
    "GM_ETH_WETHe_USDC": 18,
    "GM_AVAX_WAVAX_USDC": 18,
    "GM_SOL_SOL_USDC": 18,
    "YY_AAVE_AVAX": 18,
    "YY_PTP_sAVAX": 18,
    "YY_GLP": 18,
    "PNG_AVAX_USDC_LP": 18,
    "PNG_AVAX_USDT_LP": 18,
    "PNG_AVAX_ETH_LP": 18,
    "TJ_AVAX_USDC_LP": 18,
    "TJ_AVAX_USDT_LP": 18,
    "TJ_AVAX_ETH_LP": 18,
    "TJ_AVAX_BTC_LP": 18,
    "TJ_AVAX_sAVAX_LP": 18,
    "YY_PNG_AVAX_USDC_LP": 18,
    "YY_PNG_AVAX_ETH_LP": 18,
    "YY_TJ_AVAX_USDC_LP": 18,
    "YY_TJ_AVAX_ETH_LP": 18,
    "YY_TJ_AVAX_sAVAX_LP": 18,
    "MOO_TJ_AVAX_USDC_LP": 18,
    "GLP": 18,
    "USDT.e": 6,
    "BAL": 18,
    "GGP": 18,
    "crvUSDBTCETH": 18,
    "SHLB_AVAX-USDC_B": 18,
    "SHLB_BTC.b-AVAX_B": 18,
    "SHLB_USDT.e-USDt_C": 18,
    "SHLB_EUROC-USDC_V2_1_B": 18,
    "SHLB_JOE-AVAX_B": 18,
    "TJLB_AVAX-USDC": 18,
    "TJLB_BTC.b-USDC": 18,
    "TJLB_BTC.b-AVAX": 18,
    "TJLB_USDT-USDC": 18,
    "TJLB_ETH-AVAX": 18,
    "TJ_AVAX_USDC_AUTO": 18,
    "BAL_ggAVAX_AVAX": 18,
    "BAL_yyAVAX_AVAX": 18,
    "BAL_sAVAX_AVAX": 18,
    "BAL_GG_AVAX_MAIN": 18,
    "BAL_YY_AVAX_MAIN": 18,
    "BAL_S_AVAX_MAIN": 18
};


const EVENT_NAME = "Liquidate"; //event name

const START_TIMESTAMP = 1673352000; //10.01.2023
const END_TIMESTAMP = 1712059200; //01.04.2024
// const START_TIMESTAMP = 1705752000;
// const END_TIMESTAMP = 1708430400;

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
const query = (i, timestampInSecStart, timestampInSecEnd) => `
{
    transactions(
      first: 1000,
      skip: ${1000 * i}
      where: {
        txType: "${EVENT_NAME}",
        timestamp_gte: ${timestampInSecStart},
        timestamp_lte: ${timestampInSecEnd},
      }
    ) {
      id  
      timestamp
    }
}
`;

// const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/keizir/deltaprime';
const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/mbare0/deltaprime';

async function getTransactions(start, end) {
    let txs = [];
    for (let i = 0; i < 5; i++) {
        txs.push(...(await fetchTransactionsForPeriod(start, end, i)));
    }

    console.log({date: start, txs: txs})

    return {date: start, txs: txs};
}

const fetchTransactionsForPeriod = async (timestampInSecStart, timestampInSecEnd, i) => {
    const pairQuery = gql(query(i, timestampInSecStart, timestampInSecEnd))

    const httpLink = createHttpLink({
        uri: graphqlUrl,
        fetch: fetch
    });

    const client = new ApolloClient({
        link: httpLink,
        cache: new InMemoryCache()
    });

    const response = await client.query({ query: pairQuery });

    return response.data.transactions;
}

function arrayToCSV(data) {
    const csvRows = [];

    for (const row of data) {
        csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
}

async function getAndSaveTransactions(start, end, filename) {
    let txs = [];
    for (let i = 0; i < 5; i++) {
        txs.push(...(await fetchTransactionsForPeriod(start, end, i)));
    }

    console.log({date: start, txs: txs})

    if (filename) {
        let json = {};
        json.list = txs;

        fs.writeFileSync(`${filename}.json`, JSON.stringify(json));
    }

    return {date: start, txs: txs};
}
const parseERC20Transfers = async (filename) => {
    let txs = JSON.parse(fs.readFileSync(`${filename}.json`)).list;
    // let txs = JSON.parse(fs.readFileSync(`${filename}.json`)).list.slice(0, 20);
    const prices = JSON.parse(fs.readFileSync('historical_prices_array.json')).list;
    prices.sort((a, b) => a[0] - b[0]);
    txs.sort((a, b) => a.timestamp - b.timestamp);
    // txs = txs.slice(-50)

    let cumulativeTransferValue = 0;
    let allTransfersJson = {};
    let transfersPerTimestampJson = {};
    let highWorthAccountTxs = [];

    for (let tx of txs) {
        let receipt = await provider.getTransactionReceipt(tx.id);
        let logs = receipt.logs;
        let caller = receipt.from.toLowerCase();
        let contractCalled = receipt.to.toLowerCase();


        let liquidationContracts = new Set();

        for (let log of logs) {
            const TRANSFER_EVENT_HASH = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
            if (log.topics[0] === TRANSFER_EVENT_HASH) {
                let fromAddress = '0x' + log.topics[1].slice(-40).toLowerCase();
                let toAddress = '0x' + log.topics[2].slice(-40).toLowerCase();
                const sentToStabilityPool = toAddress === STABILITY_POOL_ADDRESS.toLowerCase();
                const sentToFeesTreasury = toAddress === FEES_TREASURY_ADDRESS.toLowerCase();
                // const sentToLiquidator = receipt.from.slice(-5).toLowerCase() === toAddress.slice(-5).toLowerCase();

                const sentToLiquidator = caller === toAddress; //sent to the liquidator

                if (sentToLiquidator || sentToStabilityPool || sentToFeesTreasury) {
                    const timestamp =  (await provider.getBlock(receipt.blockNumber)).timestamp;

                    let tokenAddress = log.address;

                    let tokenSymbol = Object.entries(tokenAddressesJson).find(([k,v]) => v.toLowerCase() === tokenAddress.toLowerCase())[0];

                    let i = 1;
                    let feed;
                    let feedTimestamp;
                    let noFeedAtTimestamp = false;

                    while (!feed && i < prices.length) {
                        if ((parseInt(prices[i - 1][0]) > timestamp && timestamp < parseInt(prices[i][0])) ||
                            noFeedAtTimestamp ||
                            i === prices.length - 1
                        ) {
                            feed = prices[i - 1][1].find(feed => feed.dataFeedId === tokenSymbol);

                            if (!feed) {
                                noFeedAtTimestamp = true;
                            } else {
                                feedTimestamp = prices[i - 1][0];
                            }
                        }

                        i++;
                    }

                    const tokenDecimals = DECIMALS[tokenSymbol];

                    if (!feed) {
                        console.log(`Missing feed for ${tokenSymbol}, timestamp: ${timestamp}`)
                    } else {
                        const tokenAmount = formatUnits(log.data, tokenDecimals);
                        const tokenValue
                            = feed.value * tokenAmount;

                        // if (sentToLiquidator) {
                        //     console.log('--------------')
                        //     console.log('tokenSymbol: ', tokenSymbol)
                        //     console.log('tokenAddress: ', tokenAddress)
                        //     console.log('tokenAmount: ', tokenAmount)
                        // // }
                        if (tokenValue > 5000) {
                            console.log(`Tx id: :${tx.id}, Liquidation timestamp: ${timestamp}, feed timestamp: ${feedTimestamp}, token: ${tokenSymbol}, decimals: ${tokenDecimals}, token amount: ${tokenAmount}, token value: ${tokenValue}$`)
                            highWorthAccountTxs.push([tx.id, tokenValue]);
                        }

                        const receiverNumber = sentToLiquidator ? 0 : (sentToStabilityPool ? 1 : 2);
                        //TODO: list element at the end...
                        allTransfersJson[timestamp] = {
                            hash: tx.id,
                            liquidationTimestamp:  timestamp,
                            feedTimestamp:  feedTimestamp,
                            tokenSymbol:  tokenSymbol,
                            tokenDecimals:  tokenDecimals,
                            tokenAmount:  tokenAmount,
                            tokenValue:  tokenValue,
                            sentTo: receiverNumber
                        };

                        //TODO: list element at the end...

                        if (!transfersPerTimestampJson[timestamp]) {
                            transfersPerTimestampJson[timestamp] = [0, 0, 0];
                        }

                        transfersPerTimestampJson[timestamp][receiverNumber] += tokenValue;

                        cumulativeTransferValue += tokenValue;
                    }
                }
            }
        }

        if (!Object.values(allTransfersJson).find(el => el.hash === tx.id)) {
            console.log('Missing txs for: ', tx.id)
        }
    }

    let cumulatedValuesArray = Object.entries(transfersPerTimestampJson).map(([k,v]) => {
            return [k, ...v];
        }
    );

    // console.log(cumulatedValuesArray)

    const weeksJson = {};
    for (let i = START_TIMESTAMP; i <= END_TIMESTAMP; i += 3600 * 24 * 7) {
        weeksJson[i] = [0,0,0];
    }

    let weeksArray = Object.keys(weeksJson);

    for (let record of cumulatedValuesArray) {
        for (let i = 0; i < weeksArray.length; i++) {
            if (weeksArray[i] <= record[0] && weeksArray[i + 1] > record[0]) {
                weeksJson[weeksArray[i]][0] += record[1];
                weeksJson[weeksArray[i]][1] += record[2];
                weeksJson[weeksArray[i]][2] += record[3];
            }
        }
    }

    console.log(highWorthAccountTxs)

    let weeksData = Object.keys(weeksJson).map(timestamp => [timestamp, ...weeksJson[timestamp]]);


    const csvData = arrayToCSV(cumulatedValuesArray);
    const csvWeeklyData = arrayToCSV(weeksData);

    const csvPath = `liquidations-${START_TIMESTAMP}-${END_TIMESTAMP}.csv`; // Path where you want to save the CSV file
    const csvWeeklyPath = `liquidations-${START_TIMESTAMP}-${END_TIMESTAMP}-weekly.csv`; // Path where you want to save the CSV file

    // fs.writeFile(csvPath, csvData, (err) => {
    //     if (err) throw err;
    //     console.log('CSV file has been saved.');
    // });
    //
    // fs.writeFile(csvWeeklyPath, csvWeeklyData, (err) => {
    //     if (err) throw err;
    //     console.log('CSV file has been saved.');
    // });
    //
    // fs.writeFileSync(`liquidations-${START_TIMESTAMP}-${END_TIMESTAMP}.json`, JSON.stringify(allTransfersJson));
    // fs.writeFileSync(`liquidations-cumulated-${START_TIMESTAMP}-${END_TIMESTAMP}.json`, JSON.stringify(transfersPerTimestampJson));


    console.log(`Cumulative transferred: ${cumulativeTransferValue}`)
}

const modifyHistoricalPrices = async () => {
    const prices = JSON.parse(fs.readFileSync('historical_prices.json'));

    const pricesArray = [];

    Object.entries(prices).forEach(
        ([k,v]) => {
            pricesArray.push([k, v])
        }
    );

    pricesArray.sort((a, b) => a[0] - b[0]);

    let json = {};
    json.list = pricesArray;

    fs.writeFileSync('historical_prices_array.json', JSON.stringify(json));
}

const analyzePortfoliosByEvent= async (txs) => {
    const REPAYMENT_EVENT_HASH = '0x24fcca58a997b1b2eff6db8107e860458544c09ddd3693b3b779e1df6c0d6c5d';
    const dataServiceId = "redstone-avalanche-prod";

    let array = [];

    for (let tx of txs) {
        console.log(0)
        let receipt = await provider.getTransactionReceipt(tx);
        let logs = receipt.logs;

        for (let log of logs) {
            if (log.topics[0] === REPAYMENT_EVENT_HASH) {
                console.log(1)
                let address = '0x' + log.topics[1].slice(-40).toLowerCase();
                let loan = new ethers.Contract(address, ARTIFACT.abi, wallet);
                console.log(2)
                let smartLoan = await wrapContract(loan, null, dataServiceId);
                console.log(3)

                array.push([tx, address, fromWei(await smartLoan.getTotalValue())]);
                break;
            }
        }
    }

    console.log(array)
}

// analyzePortfoliosByEvent([]);
// modifyHistoricalPrices()
// getAndSaveTransactions(START_TIMESTAMP, END_TIMESTAMP, `liquidation-txs-${START_TIMESTAMP}-${END_TIMESTAMP}`);
// parseERC20Transfers(`liquidation-txs-${START_TIMESTAMP}-${END_TIMESTAMP}`);
