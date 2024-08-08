const AWS = require('aws-sdk');

// AWS DynamoDB setup
AWS.config.update({ region: 'eu-central-1' });
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports = {
  dynamoDb,
}