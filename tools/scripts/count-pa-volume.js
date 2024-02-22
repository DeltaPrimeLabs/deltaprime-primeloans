const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const fs = require("fs");

const gql = require("graphql-tag");
const fetch = require("node-fetch");

const START_TIMESTAMP = 1705320000; //14.01.2024
const END_TIMESTAMP = 1707998400; //14.02.2024
// const START_TIMESTAMP = 1705752000;
// const END_TIMESTAMP = 1708430400;

const query = (i, timestampInSecStart, timestampInSecEnd) => `
{
    transactions(
      first: 1000,
      skip: ${1000 * i}
      where: {
        txType: "Swap",
        timestamp_gte: ${timestampInSecStart},
        timestamp_lte: ${timestampInSecEnd},
      }
    ) {
      toAsset
      toAmount
      fromAsset
      fromAmount
    }
}
`;

// const query = (i, timestampInSecStart, timestampInSecEnd) => `
// {
//     transactions(
//       first: 1000,
//       skip: ${1000 * i}
//       where: {
//         txType: "GLPMint",
//         timestamp_gte: ${timestampInSecStart},
//         timestamp_lte: ${timestampInSecEnd},
//       }
//     ) {
//       toAsset
//       toAmount
//     }
// }
// `;

const ASSET_TO_PROP = 'toAsset';
const ASSET_TO_AMOUNT_PROP = 'toAmount';

const ASSET_FROM_PROP = 'fromAsset';
const ASSET_FROM_AMOUNT_PROP = 'fromAmount';

// const ASSET_EVENT_PROP = 'tokenToMintWithSymbol';
// const ASSET_AMOUNT_PROP = 'tokenToMintWithAmount';


const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/keizir/deltaprime';
// const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/mbare0/deltaprime';

const DECIMALS = {
    BTC: 8,
    USDC: 6,
    USDT: 6,
    "USDT.e": 6,
    EUROC: 6
}
async function runDaily() {
    const prices = JSON.parse(fs.readFileSync('historical_prices.json'));

    let start = START_TIMESTAMP;
    const interval = 24 * 3600;
    let end = start + interval;

    let dates = [];

    while (end < END_TIMESTAMP) {
        dates.push(start);
        start = end;
        end += interval;
    }

    let data = (await Promise.all(dates.map(date => getTransactions(date, date + interval))));

    let volumeTo = 0;
    let volumeFromAsset = {};
    let volumeToAsset = {};
    let volumePair = {};

    // console.log(data)

    for (let day of data) {
        console.log(day)
        for (let tx of day.txs) {
            console.log(`day.date: ${day.date}`)
            const feedFrom = prices[day.date].find(feed => feed.dataFeedId === tx[ASSET_FROM_PROP]);
            const feedTo = prices[day.date].find(feed => feed.dataFeedId === tx[ASSET_TO_PROP]);

            console.log(`tx[ASSET_FROM_PROP]: ${tx[ASSET_FROM_PROP]}`)
            console.log(`tx[ASSET_TO_PROP]: ${tx[ASSET_TO_PROP]}`)
            console.log(tx)

            let priceFrom = 0;
            let priceTo = 0;

            if (feedFrom) {
                priceFrom = feedFrom.value;
            } else {
                console.log(`No feed for ${tx[ASSET_FROM_PROP]} at ${day.date}`)
            }

            if (feedTo) {
                priceTo = feedTo.value;
            } else {
                console.log(`No feed for ${tx[ASSET_TO_PROP]} at ${day.date}`)
            }
            // console.log(day.date)
            // console.log(price)
            // console.log(`price ${tx.toAsset}: `, price)
            let decimalsFrom = DECIMALS[tx[ASSET_FROM_PROP]] ? DECIMALS[tx[ASSET_FROM_PROP]] : 18;
            let amountFrom = tx[ASSET_FROM_AMOUNT_PROP] / 10**decimalsFrom;

            let decimalsTo = DECIMALS[tx[ASSET_TO_PROP]] ? DECIMALS[tx[ASSET_TO_PROP]] : 18;
            let amountTo = tx[ASSET_TO_AMOUNT_PROP] / 10**decimalsTo;

            volumeTo += priceTo * amountTo;
            if (feedFrom) volumeFromAsset[feedFrom.dataFeedId] = volumeFromAsset[feedFrom.dataFeedId] ? volumeFromAsset[feedFrom.dataFeedId] + priceFrom * amountFrom : priceFrom * amountFrom;
            if (feedTo) volumeToAsset[feedTo.dataFeedId] = volumeToAsset[feedTo.dataFeedId] ? volumeToAsset[feedTo.dataFeedId] + priceTo * amountTo : priceTo * amountTo;
            if (feedFrom && feedTo) volumePair[feedFrom.dataFeedId + feedTo.dataFeedId] = volumePair[feedFrom.dataFeedId + feedTo.dataFeedId] ? volumePair[feedFrom.dataFeedId + feedTo.dataFeedId] + priceTo * amountTo : priceTo * amountTo;


            console.log(`Volume at ${day.date}: $${volumeTo}`)
        }
    }

    console.log('Volume from: ')
    console.log(volumeFromAsset)
    console.log('Volume to: ')
    console.log(volumeToAsset)
    console.log('Volume pairs: ')
    console.log(volumePair)
}

// async function runMonthly() {
//     let json = {};
//     let start = START_TIMESTAMP;
//
//     let results = [];
//
//     for (let month = 0; month < 12; month++) {
//         let currentMonthStartDate = start;
//         const interval = 24 * 3600;
//         let end = start + interval;
//
//         let dates = [];
//
//         while (end < currentMonthStartDate + 31 * interval) {
//             dates.push(start);
//             start = end;
//             end += interval;
//         }
//
//         let currentMonthUsers = (await Promise.all(dates.map(date => getTransactions(date, date + interval)))).map(set => Array.from(set)).flat();
//         results.push((new Set(currentMonthUsers)).size)
//
//
//     }
//     json.active = results;
//
//     fs.writeFileSync('active-prime-accounts-monthly.json', JSON.stringify(json));
//
// }
async function getTransactions(start, end) {
    let txs = [];
    for (let i = 0; i < 5; i++) {
        txs.push(...(await fetchTransactionsForPeriod(start, end, i)));
    }

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

runDaily();
