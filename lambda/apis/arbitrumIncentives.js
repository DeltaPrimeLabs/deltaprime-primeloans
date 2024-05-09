const {
  dynamoDb,
} = require('../utils/helpers');

const getArbitrumIncentivesApi = (event, context, callback) => {
  const params = {
    TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE
  };

  dynamoDb.scan(params).promise()
    .then(result => {
      let accumulatedIncentives = 0;

      const incentives = result.Items.sort((a, b) => b.arbCollected - a.arbCollected);

      incentives.map((item) => {
        accumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
      });

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          total: accumulatedIncentives,
          list: result.Items
        }),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
      return;
    });
};

const getLoanArbitrumIncentivesApi = (event, context, callback) => {
  let params = {
    TableName: process.env.LOAN_ARB_TABLE
  };

  dynamoDb.scan(params).promise()
    .then(result => {
      const arbLoans = result.Items;

      const params = {
        TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE
      };

      dynamoDb.scan(params).promise()
        .then(result => {
          const incentivesOfLoans = [];

          arbLoans.map(loan => {
            const loanIncentives = result.Items.filter((item) => item.id == loan.id)

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
          });

          const sortedIncentives = incentivesOfLoans.sort((a, b) => b.arbCollected - a.arbCollected);

          const response = {
            statusCode: 200,
            body: JSON.stringify({
              list: sortedIncentives
            }),
          };
          callback(null, response);
        })
        .catch(error => {
          console.error(error);
          callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
          return;
        });
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch Arbitrum Incentives values.'));
      return;
    });;
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