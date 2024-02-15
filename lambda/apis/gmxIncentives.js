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

module.exports = {
  getGmxIncentivesApi,
  getGmxIncentivesFromApi,
  getGmxIncentivesRetroactiveApi,
  getGmBoostApyApi
}