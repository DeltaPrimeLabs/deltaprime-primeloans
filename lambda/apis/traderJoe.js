const fetch = require("node-fetch");

const BASE_URL = 'https://api.traderjoexyz.dev/v1';

const getRewardsInfoApi = async (event, context, callback) => {
  const chain = event.queryStringParameters.chain;
  const loan = event.queryStringParameters.loan;
  const market = event.queryStringParameters.market;
  const token = event.queryStringParameters.token;

  if (!chain || !loan || !market || !token) {
    callback(new Error('required params invalid.'));
  }

  try {
    // get user claimable rewards
    const rewardsRes = await fetch(`${BASE_URL}/rewards/claimable/${chain}/${loan}?market=${market}`, {
      method: "GET",
      headers: {
        "x-traderjoe-api-key": process.env.TJ_API_KEY
      }
    });
    const rewards = await rewardsRes.json();
    console.log('claimable rewards: ', rewards);

    // get user proofs
    const batch = rewards.map(reward => ({
      market,
      epoch: reward.epoch,
      token
    }));
    console.log(batch);

    const proofsRes = await fetch(`${BASE_URL}/rewards/batch-proof/${chain}/${loan}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-traderjoe-api-key": process.env.TJ_API_KEY
      },
      body: JSON.stringify({ batch })
    });
    const proofs = await proofsRes.json();
    console.log(proofs);

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        rewards,
        proofs
      }),
    };

    callback(null, response);
  } catch (error) {
    console.log(`fetching rewards info failed. ${error}`);
    callback(new Error('Couldn\'t fetch rewards info.'));
  }
}

module.exports = {
  getRewardsInfoApi
}
