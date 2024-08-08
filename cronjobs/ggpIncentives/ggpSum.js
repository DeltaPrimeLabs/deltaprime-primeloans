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
        ":min": 1721057751
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

    console.log(totalIncentivesPerHour)
  } catch(error) {
    console.error('Error', error);
  };
};

ggpIncentivesChecker();