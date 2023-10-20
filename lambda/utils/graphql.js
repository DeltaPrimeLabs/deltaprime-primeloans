const { GraphQLClient } = require("graphql-request");
const {
  poolQuery,
  transferQuery,
  depositorQuery
} = require("./queries");
const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;

const GRAPH_API = {
  "avalanche": "https://api.thegraph.com/subgraphs/name/mbare0/deltaprime",
  "arbitrum": "https://api.thegraph.com/subgraphs/name/keizir/deltaprime"
};

const fetchPools = async (network) => {
  const client = new GraphQLClient(GRAPH_API[network]);

  let pools = [];
  let page = 0;
  let limit = 1000;

  let response = await client.request(poolQuery(limit, page));

  while (response.pools.length > 0) {
    pools = pools.concat(response.pools);
    page++;    

    response = await client.request(poolQuery(limit, page));
  }

  return pools;
}

const fetchTransfersForPool = async (network, poolId, offset = 0) => {
  const client = new GraphQLClient(GRAPH_API[network]);

  // let transfers = [];
  // let page = 0;
  let limit = 120;
  let lm_start_date = 1693756800; // LM start date: 3th Sep, 6pm CEST

  let response = await client.request(transferQuery(poolId, limit, offset, lm_start_date));

  // while (response.transfers.length > 0) {
  //   transfers = transfers.concat(response.transfers);
  //   page++;    

  //   response = await client.request(transferQuery(poolId, limit, page));
  // }

  return response.transfers;
}

const fetchAllDepositors = async (network) => {
  const client = new GraphQLClient(GRAPH_API[network]);

  let depositors = [];
  let page = 0;
  let limit = 1000;

  let response = await client.request(depositorQuery(limit, page));

  while (response.depositors.length > 0) {
    depositors = depositors.concat(response.depositors);
    page++;    

    response = await client.request(depositorQuery(limit, page));
  }

  return depositors;
}

const fetchTraderJoeLpApr = async (lpAddress, assetAppreciation = 0) => {
  const tjSubgraphUrl = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange';
  const FEE_RATE = 0.0025;
  const aprDate = new Date();
  const date = Math.round(aprDate.getTime() / 1000 - 32 * 3600);

  const pairQuery = gql(`
{
  pairs(
    first: 1
    where: {id: "${lpAddress.toLowerCase()}"}
  ) {
    id
    name
    token0Price
    token1Price
    token0 {
      id
      symbol
      decimals
    }
    token1 {
      id
      symbol
      decimals
    }
    reserve0
    reserve1
    reserveUSD
    volumeUSD
    hourData(
        first: 25
        where: {date_gte: ${date}}
        orderBy: date
        orderDirection: desc
      ) {
        untrackedVolumeUSD
        volumeUSD
        date
        volumeToken0
        volumeToken1
      }
    timestamp
    }
  }
`)

  const httpLink = createHttpLink({
    uri: tjSubgraphUrl,
    fetch: fetch
  });

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache()
  });

  const response = await client.query({ query: pairQuery });

  const hourData = response.data.pairs[0].hourData;
  hourData.shift();

  let volumeUSD = parseFloat(hourData.reduce((sum, data) => sum + parseFloat(data.volumeUSD), 0));
  let reserveUSD = parseFloat(response.data.pairs[0].reserveUSD);



  const feesUSD = volumeUSD * FEE_RATE;

  return ((1 + feesUSD * 365 / reserveUSD) * (1 + assetAppreciation / 100) - 1) * 100;
}

module.exports = {
  fetchPools,
  fetchTransfersForPool,
  fetchAllDepositors,
  fetchTraderJoeLpApr
}