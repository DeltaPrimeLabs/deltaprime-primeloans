const { dynamoDb } = require('../utils/helpers');

const getTermsInfoApi = (event, context, callback) => {
  const params = {
    TableName: process.env.TERMS_VERSION_TABLE,
    KeyConditionExpression: 'walletAddress = :walletAddress',
    ExpressionAttributeValues: {
      ':walletAddress': event.pathParameters.walletAddress
    }
  };

  dynamoDb.query(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Items),
      };
      callback(null, response);
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

const saveTermsInfoApi = (event, context, callback) => {
  const data = JSON.parse(event.body);

  const termsData = {
    walletAddress: data.walletAddress,
    paAddress: data.paAddress,
    signResult: data.signResult,
    termsVersion: data.termsVersion,
    type: data.type
  };

  const params = {
    TableName: process.env.TERMS_VERSION_TABLE,
    Item: termsData
  };

  dynamoDb.put(params).promise()
    .then(result => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: 'terms version saved successfully.'
        }),
        headers: {
          'Content-Type': 'application/json',
        }
      });
      return;
    })
}

module.exports = {
  getTermsInfoApi,
  saveTermsInfoApi
}