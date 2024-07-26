const { fetchAllDataFromDB } = require('../utils/helpers');

const getLoanStatsApi = async (event, context, callback) => {
  try {
    const address = Number(event.queryStringParameters.address);
    const from = Number(event.queryStringParameters.from); // query all as default
    const to = Number(event.queryStringParameters.to) || Math.floor(Date.now() / 1000); // query all as default
    const network = Number(event.queryStringParameters.network);

    let LOAN_STATS_TABLE;
    if (network == 'avalanche') {
      LOAN_STATS_TABLE = process.env.LOAN_STATS_AVA_TABLE;
    } else if (network == 'arbitrum') {
      LOAN_STATS_TABLE = process.env.LOAN_STATS_ARB_TABLE;
    }

    const params = {
      TableName: LOAN_STATS_TABLE,
      KeyConditionExpression: 'id = :paAddress',
      ExpressionAttributeValues: {
        ':paAddress': address.toLowerCase()
      }
    };

    const loanStats = await fetchAllDataFromDB(params, false);

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        data: loanStats
      })
    };
    console.log(loanStats.length)
    callback(null, response);
  } catch (error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch loan stats.'));
    return;
  }
}

module.exports = {
  getLoanStatsApi
}