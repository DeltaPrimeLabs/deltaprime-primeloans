const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const sPrimeAggregator = (event, context, callback) => {
  const params = {
    TableName: event.queryStringParameters.network === 'arbitrum' ? process.env.SPRIME_ARB_TABLE : process.env.SPRIME_AVA_TABLE,
    Key: {
      id: event.pathParameters.id
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
      callback(new Error('Couldn\'t fetch sPRIME values for depositor.'));
      return;
    });
};

module.exports = {
  sPrimeAggregator
}