const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const assetApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.APY_TABLE,
  };

  dynamoDb.scan(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Items),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch APYs.'));
      return;
    });
};

module.exports = {
  assetApyApi
}