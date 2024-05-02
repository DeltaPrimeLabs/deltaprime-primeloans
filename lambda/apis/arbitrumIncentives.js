const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getArbitrumIncentivesApi = (event, context, callback) => {
  const params = {
    TableName: process.env.ARBITRUM_INCENTIVES_ARB_TABLE,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': event.pathParameters.id.toLowerCase()
    }
  };

  dynamoDb.query(params).promise()
    .then(result => {
      let accumulatedIncentives = 0;

      result.Items.map((item) => {
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

module.exports = {
  getArbitrumIncentivesApi
}