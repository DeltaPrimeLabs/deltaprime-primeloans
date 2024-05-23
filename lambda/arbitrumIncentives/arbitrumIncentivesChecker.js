const fetch = require('node-fetch');
const {
  dynamoDb, fetchAllDataFromDB
} = require('../utils/helpers');
const pingUrl = require('../.secrets/ping.json');

const arbitrumIncentivesChecker = async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const params = {
      TableName: "arbitrum-incentives-arb-prod",
      FilterExpression: "#timestamp > :min",
      ExpressionAttributeValues: {
        ":min": now - 60 * 60
      },
      ExpressionAttributeNames: {
        "#timestamp": "timestamp"
      }
    };

    const result = await fetchAllDataFromDB(params, true);

    let totalIncentivesPerHour = 0;

    result.map((item) => {
      totalIncentivesPerHour += item.arbCollected ? Number(item.arbCollected) : 0;
    });
    console.log(totalIncentivesPerHour);

    if (Math.abs(totalIncentivesPerHour - 0.5952380952380952) < 0.0000000000001) { // change the value accordingly based on incentives of interval
      const res = await fetch(pingUrl.ltipPAChecker.success);
      console.log(res);
    } else {
      const res = await fetch(pingUrl.ltipPAChecker.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(error)
      });
      console.log(res);
    }
  } catch(error) {
    console.error('Error', error);
  };
};

arbitrumIncentivesChecker();