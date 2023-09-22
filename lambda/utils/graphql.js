const { GraphQLClient } = require("graphql-request");
const gql = require("graphql-tag");

const GRAPH_API = "https://api.thegraph.com/subgraphs/name/keizir/deltaprime";
const client = new GraphQLClient(GRAPH_API);

const poolQuery = (limit = 1000, page = 0) => {
  return gql(`
  {
    pools(
      first: ${limit}
      skip: ${page * limit}
    ) {
      id
      totalSupply
      timestamp
      decimals
    }
  }
  `);
}

const transferQuery = (poolId, limit = 1000, page = 0) => {
  return gql(`
  {
    transfers(
      first: ${limit}
      skip: ${page * limit}
      where: {pool: "${poolId}"}
      orderBy: timestamp
      orderDirection: asc
    ) {
      curPoolTvl
      amount
      id
      timestamp
      tokenSymbol
      depositor {
        id
      }
    }
  }
  `)
}

const fetchPools = async () => {
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

const fetchTransfersForPool = async (poolId) => {
  let transfers = [];
  let page = 0;
  let limit = 1000;

  let response = await client.request(transferQuery(poolId, limit, page));

  while (response.transfers.length > 0) {
    transfers = transfers.concat(response.transfers);
    page++;    

    response = await client.request(transferQuery(poolId, limit, page));
  }

  return transfers;
}

module.exports = {
  fetchPools,
  fetchTransfersForPool,
}