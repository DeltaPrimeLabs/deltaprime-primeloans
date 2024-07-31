const {
  dynamoDb,
  fetchAllDataFromDB
} = require('../utils/helpers');

const getLoanArbitrumIncentivesForApi = async (event, context, callback) => {
  try {
    const addresses = event.queryStringParameters.addresses.split(',');
    const incentivesOfAddresses = {};

    await Promise.all(
      addresses.map(async (address) => {
        let params = {
          TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE,
          KeyConditionExpression: 'id = :paAddress',
          ExpressionAttributeValues: {
            ':paAddress': address.toLowerCase()
          }
        };
    
        const incentives = await fetchAllDataFromDB(params, false);
        let loanAccumulatedIncentives = 0;

        incentives.map((item) => {
          loanAccumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
        });

        params = {
          TableName: process.env.LOAN_ARB_TABLE,
          Key: {
            id: address.toLowerCase()
          }
        };

        const loan = await dynamoDb.get(params).promise();

        incentivesOfAddresses[address] = {
          arbCollected: loanAccumulatedIncentives,
          eligibleTvl: loan.Item ? loan.Item.eligibleTvl : 0
        };
      })
    )

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        data: incentivesOfAddresses
      })
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
    return;
  };
};

// fetch top loans for LTIP PA leaderboard
const getLoanArbitrumIncentivesLeaderboardApi = async (event, context, callback) => {
  try {
    const top = Number(event.queryStringParameters.top) || null;
    // const from = Number(event.queryStringParameters.from);
    // const to = Number(event.queryStringParameters.to) || Math.floor(Date.now() / 1000);

    let params = {
      TableName: top == 200 ? process.env.LTIP_LOAN_LEADERBOARD_ARB_TABLE : process.env.LTIP_LOAN_LEADERBOARD_LASTDIST_ARB_TABLE
    };

    const incentivesOfLoans = await fetchAllDataFromDB(params, true, 50);

    const sortedIncentives = top ? incentivesOfLoans.sort((a, b) => b.arbCollected - a.arbCollected).slice(0, top) : incentivesOfLoans;

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        list: sortedIncentives
      }),
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
    return;
  };
};

const getLtipBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.STATISTICS_TABLE,
    Key: {
      id: "LTIP_LOAN"
    }
  };

  dynamoDb.get(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch LTIP Boost APY.'));
      return;
    });
};

const getPoolArbitrumIncentivesForApi = async (event, context, callback) => {
  try {
    const addresses = event.queryStringParameters.addresses.split(',');
    const depositorsIncentives = {};

    await Promise.all(
      addresses.map(async (address) => {
        const params = {
          TableName: process.env.POOL_ARBITRUM_INCENTIVES_ARB_TABLE,
          KeyConditionExpression: 'id = :depositorAddress',
          ExpressionAttributeValues: {
            ':depositorAddress': address.toLowerCase()
          }
        };
    
        const depositorIncentives = await fetchAllDataFromDB(params, false);

        if (depositorIncentives.length > 0) {
          let depositorAccumulatedIncentives = 0;
  
          depositorIncentives.map((item) => {
            depositorAccumulatedIncentives += (item.ARB ? Number(item.ARB) : 0) +
                                              (item.BTC ? Number(item.BTC) : 0) +
                                              (item.DAI ? Number(item.DAI) : 0) +
                                              (item.ETH ? Number(item.ETH) : 0) +
                                              (item.USDC ? Number(item.USDC) : 0);
          });
  
          depositorsIncentives[address] = {
            'arbCollected': depositorAccumulatedIncentives
          };
        }
      })
    )

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        data: depositorsIncentives
      }),
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch Pool Arbitrum Incentives values.'));
    return;
  };
};

// fetch top loans for LTIP Pool leaderboard
const getPoolArbitrumIncentivesLeaderboardApi = async (event, context, callback) => {
  try {
    const top = Number(event.queryStringParameters.top) || null;
    const from = Number(event.queryStringParameters.from);
    const to = Number(event.queryStringParameters.to) || Math.floor(Date.now() / 1000);

    const params = {
      TableName: process.env.POOL_ARBITRUM_INCENTIVES_ARB_TABLE,
      FilterExpression: '#timestamp >= :from AND #timestamp <= :to',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':from': from,
        ':to': to
      }
    };

    const incentives = await fetchAllDataFromDB(params, true);

    const depositorsIncentives = [];
    const poolsDepositors = {};

    incentives.map(item => {
      if (!poolsDepositors[item.id]) poolsDepositors[item.id] = 0;

      const incentivesAtTimestamp = (item.ARB ? Number(item.ARB) : 0) +
                                            (item.BTC ? Number(item.BTC) : 0) +
                                            (item.DAI ? Number(item.DAI) : 0) +
                                            (item.ETH ? Number(item.ETH) : 0) +
                                            (item.USDC ? Number(item.USDC) : 0);

      poolsDepositors[item.id] = poolsDepositors[item.id] + incentivesAtTimestamp;
    })

    Object.entries(poolsDepositors).map(([id, arbCollected]) => {
      depositorsIncentives.push({
        id,
        arbCollected
      })
    });

    const sortedIncentives = top ? depositorsIncentives.sort((a, b) => b.arbCollected - a.arbCollected).slice(0, top) : depositorsIncentives;

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        list: sortedIncentives
      }),
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch Pool Arbitrum Incentives values.'));
    return;
  };
};

const getLtipPoolBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.STATISTICS_TABLE,
    Key: {
      id: "LTIP_POOL"
    }
  };

  dynamoDb.get(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch LTIP Pool Boost APYs.'));
      return;
    });
};

const getLtipPoolTotalIncentivesApi = async (event, context, callback) => {
  try {
    let params = {
      TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE
    };

    const incentives = await fetchAllDataFromDB(params, true);

    let accumulatedIncentives = 0;

    incentives.map((item) => {
      accumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
    });

    params = {
      TableName: 'loan-eligible-tvl-arb-prod'
    };

    const tvlList = await fetchAllDataFromDB(params, true);

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        totalIncentives: accumulatedIncentives,
        totalEligibleTvls: tvlList.sort((a, b) => a.id - b.id)
      }),
    };
    callback(null, response);
  } catch (error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
    return;
  };
}

module.exports = {
  getLoanArbitrumIncentivesForApi,
  getLoanArbitrumIncentivesLeaderboardApi,
  getPoolArbitrumIncentivesForApi,
  getPoolArbitrumIncentivesLeaderboardApi,
  getLtipBoostApyApi,
  getLtipPoolBoostApyApi,
  getLtipPoolTotalIncentivesApi
}