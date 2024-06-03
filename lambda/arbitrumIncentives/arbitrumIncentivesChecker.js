const fetch = require('node-fetch');
const {
  dynamoDb, fetchAllDataFromDB
} = require('../utils/helpers');
const pingUrl = require('../.secrets/ping.json');

const threshold = 0.000001;
// 65.416666666666667 = 10990 ARB per week hourly
const expectedIncentives = 65.416666666666667; // change the value accordingly based on incentives of interval

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

    const multiplier = Math.round(totalIncentivesPerHour / expectedIncentives);

    const diff = Math.abs(totalIncentivesPerHour / multiplier - expectedIncentives); 
    console.log(`totalIncentivesPerHour: ${totalIncentivesPerHour / multiplier}, diff: ${diff}`);

    if (diff < threshold) {
      await fetch(pingUrl.ltipPAChecker.success);
    } else {
      await fetch(pingUrl.ltipPAChecker.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errorMessage: `difference: ${diff}, threshold set: ${threshold}, expected incentives per interval: ${expectedIncentives}`
        })
      });
    }
  } catch(error) {
    console.error('Error', error);
  };
};

arbitrumIncentivesChecker();