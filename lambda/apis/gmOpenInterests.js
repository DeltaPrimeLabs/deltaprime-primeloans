const {
  dynamoDb,
  fetchAllDataFromDB
} = require("../utils/helpers");

const getGmOpenInterestsApi = async (event, context, callback) => {
  try {
    const params = {
      TableName: process.env.GM_OPEN_INTEREST_TABLE,
    };

    const result = await fetchAllDataFromDB(params, true);

    const openInterests = result.sort((a, b) => a.id - b.id);
    const response = {
      statusCode: 200,
      body: JSON.stringify(openInterests),
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch GM Open Interests.'));
    return;
  };
};

module.exports = {
  getGmOpenInterestsApi
}