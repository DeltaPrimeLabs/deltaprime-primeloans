const {
  dynamoDb,
  fetchAllDataFromDB
} = require('../utils/helpers');

const getArbitrumIncentivesApi = async (event, context, callback) => {
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
        total: accumulatedIncentives,
        list: incentives
      }),
    };
    callback(null, response);
  } catch (error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
    return;
  };
};

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

const getLtipBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "LTIP_BOOST"
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

module.exports = {
  getArbitrumIncentivesApi,
  getLoanArbitrumIncentivesApi,
  getLtipBoostApyApi
}