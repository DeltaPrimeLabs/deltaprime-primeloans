const {
  fetchAllDataFromDB
} = require('../utils/helpers');

const getGgpIncentivesForApi = async (event, context, callback) => {
  try {
    const addresses = event.queryStringParameters.addresses.split(',');
    const incentivesOfAddresses = {};

    await Promise.all(
      addresses.map(async (address) => {
        let params = {
          TableName: process.env.GGP_INCENTIVES_AVA_TABLE,
          KeyConditionExpression: 'id = :paAddress',
          ExpressionAttributeValues: {
            ':paAddress': address.toLowerCase()
          }
        };
    
        const incentives = await fetchAllDataFromDB(params, false);
        let loanAccumulatedIncentives = 0;

        incentives.map((item) => {
          loanAccumulatedIncentives += item.ggpCollected ? Number(item.ggpCollected) : 0;
        });

        incentivesOfAddresses[address] = {
          ggpCollected: loanAccumulatedIncentives
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
    callback(new Error('Couldn\'t fetch GGP Incentives values.'));
    return;
  };
};

const getGgpBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.STATISTICS_TABLE,
    Key: {
      id: "GGP_ggAVAX"
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
      callback(new Error('Couldn\'t fetch GGP Boost APY.'));
      return;
    });
};

module.exports = {
  getGgpIncentivesForApi,
  getGgpBoostApyApi
}