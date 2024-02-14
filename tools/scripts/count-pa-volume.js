const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const fs = require("fs");

const gql = require("graphql-tag");
const fetch = require("node-fetch");

const START_TIMESTAMP = 1705263543; //14.01.2024
const END_TIMESTAMP = 1707941969; //14.02.2024

// const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/keizir/deltaprime';
const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/mbare0/deltaprime';

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

    let volume = 0;

    // console.log(data)

    for (let day of data) {
        console.log(day)
        for (let tx of day.txs) {
            console.log(`day.date: ${day.date}`)
            const feed = prices[day.date].find(feed => feed.dataFeedId === tx.toAsset);

            let price = 0;

            if (feed) {
                price = feed.value;
            } else {
                console.log(`No feed for ${tx.toAsset} at ${day.date}`)
            }
            // console.log(day.date)
            // console.log(price)
            // console.log(`price ${tx.toAsset}: `, price)
            let decimals = DECIMALS[tx.toAsset] ? DECIMALS[tx.toAsset] : 18;
            let amount = tx.toAmount / 10**decimals;
            volume += price * amount;

            // console.log('price: ', price)
            // console.log('amount: ', amount)

            console.log(`Volume at ${day.date}: $${volume}`)
        }
    }

    // console.log(`Final volume: `, volume)




    // fs.writeFileSync('swap-transactions.json', JSON.stringify(json));

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
    const pairQuery = gql(`
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
    }
}
`)

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
