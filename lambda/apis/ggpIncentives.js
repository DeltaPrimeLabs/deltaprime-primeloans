const {
  dynamoDb,
  fetchAllDataFromDB
} = require('../utils/helpers');

const getGgpIncentivesForApi = async (event, context, callback) => {
  try {
    const addresses = event.queryStringParameters.addresses.split(',');
    const incentivesOfAddresses = {};

    await Promise.all(
      addresses.map(async (address) => {
        let params = {
          TableName: process.env.GGP_INCENTIVES_AVA_TABLE,
          KeyConditionExpression: 'id = :paAddress',
          ExpressionAttributeValues: {
            ':paAddress': address.toLowerCase()
          }
        };
    
        const incentives = await fetchAllDataFromDB(params, false);
        let loanAccumulatedIncentives = 0;

        incentives.map((item) => {
          loanAccumulatedIncentives += item.ggpCollected ? Number(item.ggpCollected) : 0;
        });

        incentivesOfAddresses[address] = {
          ggpCollected: loanAccumulatedIncentives
        };
      })
    )

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        data: incentivesOfAddresses
      })
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch GGP Incentives values.'));
    return;
  };
};

const getGgpBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.STATISTICS_TABLE,
    Key: {
      id: "GGP_ggAVAX"
    }
  };

  dynamoDb.get(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch GGP Boost APY.'));
      return;
    });
};

const getGgpIncentivesYYWombatForLastWeekApi = async (event, context, callback) => {
    try {
        const addresses = event.queryStringParameters.addresses.split(',');
        const incentivesOfAddresses = {};

        // Get current timestamp and one week ago timestamp
        const now = Date.now();
        const oneWeekAgo = (now - 7 * 24 * 60 * 60 * 1000) / 1000; // 1 week in seconds

        await Promise.all(
            addresses.map(async (address) => {
                let currentParams = {
                    TableName: process.env.GGP_INCENTIVES_YY_WOMBAT_AVA_TABLE,
                    KeyConditionExpression: 'id = :paAddress',
                    ExpressionAttributeValues: {
                        ':paAddress': address.toLowerCase()
                    }
                };

                // Fetch all current data
                const currentIncentives = await fetchAllDataFromDB(currentParams, false);
                let loanAccumulatedIncentivesNow = 0;
                currentIncentives.map((item) => {
                    loanAccumulatedIncentivesNow += item.ggpCollected ? Number(item.ggpCollected) : 0;
                });

                // Now let's fetch data from one week ago
                let pastParams = {
                    TableName: process.env.GGP_INCENTIVES_YY_WOMBAT_AVA_TABLE,
                    KeyConditionExpression: 'id = :paAddress AND #ts <= :end',
                    ExpressionAttributeNames: {
                        '#ts': 'timestamp'
                    },
                    ExpressionAttributeValues: {
                        ':paAddress': address.toLowerCase(),
                        ':end': oneWeekAgo
                    }
                };

                const pastIncentives = await fetchAllDataFromDB(pastParams, false);
                let loanAccumulatedIncentivesOneWeekAgo = 0;
                pastIncentives.map((item) => {
                    loanAccumulatedIncentivesOneWeekAgo += item.ggpCollected ? Number(item.ggpCollected) : 0;
                });

                // Calculate the difference between now and one week ago
                const ggpCollectedDifference = loanAccumulatedIncentivesNow - loanAccumulatedIncentivesOneWeekAgo;

                incentivesOfAddresses[address] = {
                    ggpCollectedDifference: ggpCollectedDifference,
                    ggpCollectedNow: loanAccumulatedIncentivesNow,
                    ggpCollectedOneWeekAgo: loanAccumulatedIncentivesOneWeekAgo
                };
            })
        );

        // Return the results
        callback(null, {
            statusCode: 200,
            body: JSON.stringify(incentivesOfAddresses),
        });
    } catch (error) {
        callback(error);
    }
};

const getGgpIncentivesYYWombatForApi = async (event, context, callback) => {
  try {
    const addresses = event.queryStringParameters.addresses.split(',');
    const incentivesOfAddresses = {};

    await Promise.all(
      addresses.map(async (address) => {
        let params = {
          TableName: process.env.GGP_INCENTIVES_YY_WOMBAT_AVA_TABLE,
          KeyConditionExpression: 'id = :paAddress',
          ExpressionAttributeValues: {
            ':paAddress': address.toLowerCase()
          }
        };

        const incentives = await fetchAllDataFromDB(params, false);
        let loanAccumulatedIncentives = 0;

        incentives.map((item) => {
          loanAccumulatedIncentives += item.ggpCollected ? Number(item.ggpCollected) : 0;
        });

        incentivesOfAddresses[address] = {
          ggpCollected: loanAccumulatedIncentives
        };
      })
    )

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        data: incentivesOfAddresses
      })
    };
    callback(null, response);
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch GGP Incentives values.'));
    return;
  };
};

const getGgpYYWombatBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.STATISTICS_TABLE,
    Key: {
      id: "GGP_ggAVAX"
    }
  };

  dynamoDb.get(params).promise()
    .then(result => {
      const response = {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch GGP Boost APY.'));
      return;
    });
};

module.exports = {
  getGgpIncentivesForApi,
  getGgpBoostApyApi,
  getGgpIncentivesYYWombatForApi,
  getGgpYYWombatBoostApyApi,
  getGgpIncentivesYYWombatForLastWeekApi
}