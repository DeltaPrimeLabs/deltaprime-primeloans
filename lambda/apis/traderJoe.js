const fetch = require("node-fetch");

const BASE_URL = 'https://api.traderjoexyz.dev/v1';

const getRewardsInfoApi = async (event, context, callback) => {
  const chain = event.queryStringParameters.chain;
  const loan = event.queryStringParameters.loan;
  const market = event.queryStringParameters.market;

  if (!chain || !loan || !market) {
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

    const historyRes = await fetch(`${BASE_URL}/rewards/history/${chain}/${loan}?market=${market}`, {
      method: "GET",
      headers: {
        "x-traderjoe-api-key": process.env.TJ_API_KEY
      }
    });
    const rewardsHistory = await historyRes.json();

    const rewards = [];
    const batch = [];
    (await rewardsRes.json()).map(reward => {
      const history = rewardsHistory.find(history => history.epoch == reward.epoch);

      reward.claimableRewards.map(claimable => {
        const tokenHistory = history ? history.rewards.find(reward => reward.tokenAddress == claimable.tokenAddress) : null;

        rewards.push({
          epoch: reward.epoch,
          amount: claimable.amount,
          tokenAddress: claimable.tokenAddress,
          totalAmount: tokenHistory ? tokenHistory.amount : 0
        });

        batch.push({
          market,
          epoch: reward.epoch,
          token: claimable.tokenAddress
        });
      })
    });

    console.log('claimable rewards: ', rewards);
    console.log('batch: ', batch);

    // get user proofs
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
