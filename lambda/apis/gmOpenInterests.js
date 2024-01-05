const { dynamoDb } = require("../utils/helpers");

const getGmOpenInterestsApi = (event, context, callback) => {
  const params = {
    TableName: process.env.GM_OPEN_INTEREST_TABLE,
  };

  dynamoDb.scan(params).promise()
    .then(result => {
      const openInterests = result.Items.sort((a, b) => a.id - b.id);
      const response = {
        statusCode: 200,
        body: JSON.stringify(openInterests),
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