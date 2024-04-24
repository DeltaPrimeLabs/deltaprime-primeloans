const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const levelTvlApi = (event, context, callback) => {
  const params = {
    TableName: process.env.APY_TABLE,
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
      callback(new Error('Couldn\'t fetch TVL of the Level pool.'));
      return;
    });
}

module.exports = {
  levelTvlApi
}