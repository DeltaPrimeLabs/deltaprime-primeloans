const gql = require("graphql-tag");

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

const transferQuery = (poolId, limit = 1000, offset = 0, lm_start_date = 0) => {
  return gql(`
  {
    transfers(
      first: ${limit}
      skip: ${offset}
      where: {pool: "${poolId}", timestamp_gte: "${lm_start_date}"}
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
  `);
}

const depositorQuery = (limit = 1000, page = 0) => {
  return gql(`
  {
    depositors(
      first: ${limit}
      skip: ${page * limit}
    ) {
      id
    }
  }
  `);
}

module.exports = {
  poolQuery,
  transferQuery,
  depositorQuery
}