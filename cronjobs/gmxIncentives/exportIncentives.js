const { dynamoDb } = require("../utils/helpers");
const fs = require("fs");

const getLatestIncentives = async () => {
  const params = {
    TableName: "gmx-incentives-arb-prod",
  };

  const res = await dynamoDb.scan(params).promise();

  return res.Items;
};

const exportIncentives = async (event) => {
  const loanIncentives = {};
  const loanIncentivesArray = await getLatestIncentives();

  loanIncentivesArray.map((loan) => {
    loanIncentives[loan.id] = loan.arbCollected;
  });

  fs.writeFileSync('incentives.json', JSON.stringify(loanIncentives));
  console.log('successfully exported incentives.')

  return event;
}

// exportIncentives()