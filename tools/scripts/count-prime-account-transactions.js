const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const fs = require("fs");

const gql = require("graphql-tag");
const fetch = require("node-fetch");

//TODO: missing: 1676980800
const START_TIMESTAMP = 1676980800;
const END_TIMESTAMP = 1704888000;

async function runDaily() {
    let json = {};
    let start = START_TIMESTAMP;
    const interval = 24 * 3600;
    let end = start + interval;

    let dates = [];

    while (end < END_TIMESTAMP) {
        dates.push(start);
        start = end;
        end += interval;
    }


    console.log(dates)
    let results = (await Promise.all(dates.map(date => getTransactions(date, date + interval)))).map(el => el.size);

    json.active = results;
    fs.writeFileSync('active-prime-accounts-daily.json', JSON.stringify(json));

}

async function runMonthly() {
    let json = {};
    let start = START_TIMESTAMP;

    let results = [];

    for (let month = 0; month < 12; month++) {
        let currentMonthStartDate = start;
        const interval = 24 * 3600;
        let end = start + interval;

        let dates = [];

        while (end < currentMonthStartDate + 31 * interval) {
            dates.push(start);
            start = end;
            end += interval;
        }

        // console.log(dates)

        let currentMonthUsers = (await Promise.all(dates.map(date => getTransactions(date, date + interval)))).map(set => Array.from(set)).flat();
        // console.log(currentMonthUsers)
        // console.log(currentMonthUsers.length)
        results.push((new Set(currentMonthUsers)).size)


    }
    // console.log(results)
    json.active = results;

    fs.writeFileSync('active-prime-accounts-monthly.json', JSON.stringify(json));

}
async function getTransactions(start, end) {
    let users = [];
    for (let i = 0; i < 5; i++) {
        users.push(...(await fetchTransactionsForPeriod(start, end, i)));
    }
    // console.log(users.length)
    return new Set(users);
}

const fetchTransactionsForPeriod = async (timestampInSecStart, timestampInSecEnd, i) => {
    const url = 'https://api.thegraph.com/subgraphs/name/keizir/deltaprime';

    const pairQuery = gql(`
{
    transactions(   
      first: 1000,
      skip: ${1000 * i}
      where: {
        timestamp_gte: ${timestampInSecStart},
        timestamp_lte: ${timestampInSecEnd},
      }
    ) {
      user {
        id
      }
    }
}
`)

    const httpLink = createHttpLink({
        uri: url,
        fetch: fetch
    });

    const client = new ApolloClient({
        link: httpLink,
        cache: new InMemoryCache()
    });

    const response = await client.query({ query: pairQuery });

    return response.data.transactions.map(tx => tx.user.id);
}

runMonthly();
