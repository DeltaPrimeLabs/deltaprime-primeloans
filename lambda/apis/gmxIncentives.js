const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getGmxIncentivesApi = (event, context, callback) => {
  const params = {
    TableName: event.queryStringParameters.network === 'arbitrum' ? process.env.GMX_INCENTIVES_ARB_TABLE : process.env.GMX_INCENTIVES_AVA_TABLE,
    Key: {
      id: event.pathParameters.id.toLowerCase()
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
      callback(new Error('Couldn\'t fetch GMX Incentives values.'));
      return;
    });
};

const getGmBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "GM_BOOST"
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
      callback(new Error('Couldn\'t fetch GM Boost APY.'));
      return;
    });
};

module.exports = {
  getGmxIncentivesApi,
  getGmBoostApyApi
}