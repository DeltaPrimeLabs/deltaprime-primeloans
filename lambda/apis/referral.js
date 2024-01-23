const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getAccountByReferralApi = (event, context, callback) => {
  const params = {
    TableName: process.env.REFERRAL_TABLE,
    Key: {
      id: event.pathParameters.id
    }
  };

  dynamoDb.get(params).promise()
    .then(result => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify(result.Item ? result.Item : {}),
      });
    })
    .catch(error => {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 500,
        body: JSON.stringify({
          message: error.message
        })
      });
      return;
    });
};

const saveReferralApi = (event, context, callback) => {
  try {
    const data = JSON.parse(event.body);
    if (!data.id || !data.paAddress || !data.walletAddress) {
      console.error('invalid data');
      callback(new Error('paAddress or walletAddress is invalid.'));
      return;
    }

    const params = {
      TableName: process.env.REFERRAL_TABLE,
      Item: data
    };

    dynamoDb.put(params).promise()
      .then(result => {
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({
            message: 'referral saved successfully.'
          }),
          headers: {
            "Content-Type": "application/json",
          }
        });
        return;
      })
  } catch (error) {
    console.error(error);
    callback(null, {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: error.message
      }),
      headers: {
        "Content-Type": "application/json",
      }
    });
  }
};

module.exports = {
  getAccountByReferralApi,
  saveReferralApi
}