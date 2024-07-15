const {
  dynamoDb,
  fetchAllDataFromDB
} = require('../utils/helpers');

const ltipLoanLeaderboard = async() => {
  const from = 1717432200;
  const to = Math.floor(Date.now() / 1000);

  let params = {
    TableName: 'loans-arb-prod'
  };

  const arbLoans = await fetchAllDataFromDB(params, true, 50);

  params = {
    TableName: 'arbitrum-incentives-arb-prod',
    FilterExpression: '#timestamp >= :from AND #timestamp <= :to',
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':from': from,
      ':to': to
    }
  };

  const incentives = await fetchAllDataFromDB(params, true, 50);

  const incentivesOfLoans = [];

  arbLoans.map(loan => {
    const loanIncentives = incentives.filter((item) => item.id == loan.id)

    if (loanIncentives.length > 0) {
      let loanAccumulatedIncentives = 0;

      loanIncentives.map((item) => {
        loanAccumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
      });

      incentivesOfLoans.push({
        'id': loan.id,
        'arbCollected': loanAccumulatedIncentives,
        'eligibleTvl': loan.eligibleTvl
      })
    }
  })

  await Promise.all(
    incentivesOfLoans.map(async ({id, arbCollected, eligibleTvl}) => {
      const data = {
        id,
        arbCollected,
        eligibleTvl
      };

      const params = {
        TableName: 'ltip-loan-leaderboard-arb-prod',
        Item: data
      };
      await dynamoDb.put(params).promise();
    })
  );

}

ltipLoanLeaderboard();