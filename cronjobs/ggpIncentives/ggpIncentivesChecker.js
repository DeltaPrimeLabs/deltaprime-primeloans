const fetch = require('node-fetch');
const {
  fetchAllDataFromDB
} = require('../utils/helpers');
const pingUrl = require('../.secrets/ping.json');

const threshold = 0.000001;
// 7.44047619 GGP per hour = 1250 GGP per week
const expectedIncentives = 0.744047619; // change the value accordingly based on incentives of interval

const ggpIncentivesChecker = async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const params = {
      TableName: "ggp-incentives-ava-prod",
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
      totalIncentivesPerHour += item.ggpCollected ? Number(item.ggpCollected) : 0;
    });

    const multiplier = Math.round(totalIncentivesPerHour / expectedIncentives);

    const diff = Math.abs(totalIncentivesPerHour / multiplier - expectedIncentives); 
    console.log(`totalIncentivesPerHour: ${totalIncentivesPerHour / multiplier}, diff: ${diff}`);

    if (diff < threshold) {
      await fetch(pingUrl.ggpChecker.success);
    } else {
      await fetch(pingUrl.ggpChecker.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errorMessage: `difference higher than threshold`,
          difference: diff,
          threshold: threshold,
          expectedIncentives,
          sumOfIncentives: totalIncentivesPerHour / multiplier,
          multiplier: multiplier
        })
      });
    }
  } catch(error) {
    console.error('Error', error);
  };
};

ggpIncentivesChecker();