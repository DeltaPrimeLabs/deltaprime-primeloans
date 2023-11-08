const fetch = require("node-fetch");

const BASE_URL = 'https://api.traderjoexyz.dev/v1';

const getClaimableRewardsApi = async (event, context, callback) => {
  const chain = event.queryStringParameters.chain;
  const loan = event.queryStringParameters.loan;
  const market = event.queryStringParameters.market;

  if (!chain || !loan || !market) {
    callback(new Error('required params invalid.'));
  }

  try {
    const res = await fetch(`${BASE_URL}/rewards/claimable/${chain}/${loan}?market=${market}`, {
      method: "GET",
      headers: {
        "x-traderjoe-api-key": process.env.TJ_API_KEY
      }
    });
    const rewards = await res.json();
    console.log('claimable rewards: ', rewards);

    const response = {
      statusCode: 200,
      body: JSON.stringify(rewards),
    };

    callback(null, response);
  } catch (error) {
    console.log(`fetching claimable rewards failed. ${error}`);
    callback(new Error('Couldn\'t fetch claimable rewards.'));
  }
}

module.exports = {
  getClaimableRewardsApi
}
