const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const fs = require("fs");

const gql = require("graphql-tag");
const fetch = require("node-fetch");

const EVENT_NAME = "Liquidate"; //event name

const START_TIMESTAMP = 1705320000; //14.01.2024
const END_TIMESTAMP = 1709311701; //16.01.2024
// const START_TIMESTAMP = 1705752000;
// const END_TIMESTAMP = 1708430400;

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

const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/keizir/deltaprime';
// const graphqlUrl = 'https://api.thegraph.com/subgraphs/name/mbare0/deltaprime';

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

getTransactions(START_TIMESTAMP, END_TIMESTAMP)
