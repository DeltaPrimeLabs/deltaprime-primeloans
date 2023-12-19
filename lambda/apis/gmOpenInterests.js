const { dynamoDb } = require("../utils/helpers");

const getGmOpenInterestsApi = (event, context, callback) => {
  const params = {
    TableName: process.env.GM_OPEN_INTEREST_TABLE,
  };

  dynamoDb.scan(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch GM Open Interests.'));
      return;
    });
};

module.exports = {
  getGmOpenInterestsApi
}