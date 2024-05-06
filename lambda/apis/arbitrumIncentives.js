const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

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
      callback(new Error('Couldn\'t fetch GMX Incentives values.'));
      return;
    });
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
  getArbitrumIncentivesApi
}