const AWS = require('aws-sdk');
AWS.config.setPromisesDependency(require('bluebird'));
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const getGmxIncentivesApi = (event, context, callback) => {
  const params = {
    TableName: event.queryStringParameters.network === 'arbitrum' ? process.env.GMX_INCENTIVES_ARB_TABLE : process.env.GMX_INCENTIVES_AVA_TABLE,
    Key: {
      id: event.pathParameters.id.toLowerCase()
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
      callback(new Error('Couldn\'t fetch GMX Incentives values.'));
      return;
    });
};

const getGmxIncentivesFromApi = (event, context, callback) => {
  const params = {
    TableName: process.env.GMX_INCENTIVES_AVA_FROM_TABLE,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': event.pathParameters.id.toLowerCase()
    }
  };

  dynamoDb.query(params).promise()
    .then(result => {
      let accumulatedIncentives = 0;

      result.Items.map((item) => {
        accumulatedIncentives += item.avaxCollected ? Number(item.avaxCollected) : 0;
      });

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          total: accumulatedIncentives,
          list: result.Items
        }),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch GMX Incentives values.'));
      return;
    });
};

const getGmxIncentivesRetroactiveApi = (event, context, callback) => {
  const params = {
    TableName: process.env.GMX_INCENTIVES_AVA_RETROACTIVE_TABLE,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': event.pathParameters.id.toLowerCase()
    }
  };

  dynamoDb.query(params).promise()
    .then(result => {
      let accumulatedIncentives = 0;

      result.Items.map((item) => {
        accumulatedIncentives += Number(item.avaxCollected);
      });

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          total: accumulatedIncentives,
          list: result.Items
        }),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch GMX Incentives values.'));
      return;
    });
};

const getGmxIncentivesRemakeApi = async (event, context, callback) => {
  const retroactiveParams = {
    TableName: process.env.GMX_INCENTIVES_AVA_RETROACTIVE_TABLE,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': event.pathParameters.id.toLowerCase()
    }
  };

  const liveParams = {
    TableName: process.env.GMX_INCENTIVES_AVA_FROM_TABLE,
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': event.pathParameters.id.toLowerCase()
    }
  };

  try {
    const retroactive = await dynamoDb.query(retroactiveParams).promise();
    const live = await dynamoDb.query(liveParams).promise();

    const list = [...retroactive.Items, ...live.Items].sort((a, b) => a.id - b.id);

    let accumulatedIncentives = 0;

    list.map((item) => {
      accumulatedIncentives += Number(item.avaxCollected);
    });

    const response = {
      statusCode: 200,
      body: JSON.stringify({
        total: accumulatedIncentives,
        list
      }),
    };

    callback(null, response);
  } catch (error) {
    console.error(error);
    callback(new Error('Couldn\'t fetch GMX Incentives values.'));
    return;
  };
};

const getGmBoostApyApi = (event, context, callback) => {
  const params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "GM_BOOST"
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
      callback(new Error('Couldn\'t fetch GM Boost APY.'));
      return;
    });
};

const onScan = async (params, results = []) => {
  try {
    console.log(results.length);
    const result = await dynamoDb.scan(params).promise();

    if (typeof result.LastEvaluatedKey != 'undefined') {
      results = [...results, ...result.Items];
      params.ExclusiveStartKey = result.LastEvaluatedKey;
      return onScan(params, results);
    }
  } catch(error) {
    console.error(error);
    callback(new Error('Couldn\'t Incentives.'));
    return;
  };
}

const getGmxIncentivesNewApi = (event, context, callback) => {
  const params = {
    TableName: 'gmx-incentives-retroactive-ava-new',
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': event.pathParameters.id.toLowerCase()
    }
  };

  dynamoDb.query(params).promise()
    .then(result => {
      let accumulatedIncentives = 0;

      result.Items.map((item) => {
        accumulatedIncentives += Number(item.avaxCollected);
      });

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          total: accumulatedIncentives,
          list: result.Items
        }),
      };
      callback(null, response);
    })
    .catch(error => {
      console.error(error);
      callback(new Error('Couldn\'t fetch GMX Incentives values.'));
      return;
    });
};

const getIncentivesByTimestamp = async (event, context, callback) => {
  const timestamp = 1710356783;
  const params = {
    TableName: process.env.GMX_INCENTIVES_AVA_FROM_TABLE,
    FilterExpression: '#timestamp = :by_timestamp',
    ExpressionAttributeValues: {
      ':by_timestamp': timestamp
    },
    ExpressionAttributeNames: {
      '#timestamp': 'timestamp'
    }
  };

  const items = await onScan(params);
  let intervalIncentives = 0;

  items.map(item => {
    intervalIncentives += item.avaxCollected;
  });
  console.log(intervalIncentives)
  console.log(items.length);
}

module.exports = {
  getGmxIncentivesApi,
  getGmxIncentivesFromApi,
  getGmxIncentivesRetroactiveApi,
  getGmBoostApyApi,
  getGmxIncentivesRemakeApi,
  getGmxIncentivesNewApi
}