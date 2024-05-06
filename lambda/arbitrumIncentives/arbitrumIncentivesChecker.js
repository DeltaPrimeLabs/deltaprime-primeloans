const fetch = require('node-fetch');
const {
  dynamoDb
} = require('../utils/helpers');

const arbitrumIncentivesChecker = () => {
  const now = Math.floor(Date.now() / 1000);
  console.log(now - 60 * 60);
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

  dynamoDb.scan(params).promise()
    .then(async result => {
      let totalIncentivesPerHour = 0;

      result.Items.map((item) => {
        totalIncentivesPerHour += item.arbCollected ? Number(item.arbCollected) : 0;
      });
      console.log(totalIncentivesPerHour);

      if (Math.abs(totalIncentivesPerHour - 0.2232142857142857) < 0.0000000000001) { // change the value accordingly based on incentives of interval
        const res = await fetch("https://hc-ping.com/7541473d-ae8a-4b07-a632-7ea0c2be3ad7");
        console.log(res);
      } else {
        const res = await fetch("https://hc-ping.com/7541473d-ae8a-4b07-a632-7ea0c2be3ad7/fail");
        console.log(res);
      }
    })
    .catch(error => {
      console.error('Error', error);
    });
};

arbitrumIncentivesChecker();