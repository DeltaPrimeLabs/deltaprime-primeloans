const { request, gql } = require('graphql-request');
const {
  dynamoDb,
  fetchAllDataFromDB
} = require('../utils/helpers');

// const getArbitrumIncentivesApi = async (event, context, callback) => {
//   try {
//     const params = {
//       TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE
//     };

//     const incentives = await fetchAllDataFromDB(params, true);

//     let accumulatedIncentives = 0;

//     incentives.map((item) => {
//       accumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
//     });

//     const response = {
//       statusCode: 200,
//       body: JSON.stringify({
//         total: accumulatedIncentives,
//         list: incentives
//       }),
//     };
//     callback(null, response);
//   } catch (error) {
//     console.error(error);
//     callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
//     return;
//   };
// };

// fetch incentives of all the loans
const getLoanArbitrumIncentivesApi = async (event, context, callback) => {
  try {
    let params = {
      TableName: process.env.LOAN_ARB_TABLE
    };

    const arbLoans = await fetchAllDataFromDB(params, true);

    params = {
      TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE
    };

    const incentives = await fetchAllDataFromDB(params, true);

    const incentivesOfLoans = [];

    arbLoans.map(loan => {
      const loanIncentives = incentives.filter((item) => item.id == loan.id)

      if (loanIncentives.length > 0) {
        let loanAccumulatedIncentives = 0;

        loanIncentives.map((item) => {
          loanAccumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
        });

        incentivesOfLoans.push({
          'id': loan.id,
          'arbCollected': loanAccumulatedIncentives,
          'eligibleTvl': loan.eligibleTvl
        })
      }
    })

    const sortedIncentives = incentivesOfLoans.sort((a, b) => b.arbCollected - a.arbCollected);
    console.log(sortedIncentives);

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

async function getDepositorsAddressesFromSubgraph() {
  let skip = 0;
  let depositors = [];
  let hasMoreDepositors = true;

  while (hasMoreDepositors) {
    let query = gql`
        {
          depositors(first: 1000, skip: ${skip}) {
            id
          }
        }
        `
    let response = await request('https://api.thegraph.com/subgraphs/name/keizir/deltaprime', query);
    if (response.depositors.length > 0) {
      depositors = [...depositors, ...response.depositors.map(depositor => depositor.id)];
      skip += 1000;
    } else {
      hasMoreDepositors = false;
    }
  }
  // remove duplicates from depositors array
  depositors = [...new Set(depositors)];

  console.log(`Found ${depositors.length} depositors.`);
  return depositors;
}

// fetch incentives of all depositors
const getPoolArbitrumIncentivesApi = async (event, context, callback) => {
  try {
    poolsDepositors = await getDepositorsAddressesFromSubgraph();

    const params = {
      TableName: process.env.POOL_ARBITRUM_INCENTIVES_ARB_TABLE
    };

    const incentives = await fetchAllDataFromDB(params, true);

    const depositorsIncentives = [];

    poolsDepositors.map(depositor => {
      const depositorIncentives = incentives.filter((item) => item.id == depositor)

      if (depositorIncentives.length > 0) {
        let depositorAccumulatedIncentives = 0;

        depositorIncentives.map((item) => {
          depositorAccumulatedIncentives += (item.ARB ? Number(item.ARB) : 0) +
                                            (item.BTC ? Number(item.BTC) : 0) +
                                            (item.DAI ? Number(item.DAI) : 0) +
                                            (item.ETH ? Number(item.ETH) : 0) +
                                            (item.USDC ? Number(item.USDC) : 0);
        });

        depositorsIncentives.push({
          'id': depositor,
          'arbCollected': depositorAccumulatedIncentives
        })
      }
    })

    const sortedIncentives = depositorsIncentives.sort((a, b) => b.arbCollected - a.arbCollected);

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
    const params = {
      TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE
    };

    const incentives = await fetchAllDataFromDB(params, true);

    let accumulatedIncentives = 0;

    incentives.map((item) => {
      accumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
    });

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        totalIncentives: accumulatedIncentives,
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
  // getArbitrumIncentivesApi,
  getLoanArbitrumIncentivesApi,
  getLoanArbitrumIncentivesForApi,
  getPoolArbitrumIncentivesApi,
  getPoolArbitrumIncentivesForApi,
  getLtipBoostApyApi,
  getLtipPoolBoostApyApi,
  getLtipPoolTotalIncentivesApi
}