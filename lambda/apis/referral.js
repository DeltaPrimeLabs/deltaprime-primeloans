const ethers = require('ethers');
const SMART_LOAN_FACTORY_TUP = require('../abis/SmartLoansFactoryTUP.json');
const SMART_LOAN_FACTORY = require('../abis/SmartLoansFactory.json');
const {
  dynamoDb,
  arbitrumProvider,
  avalancheProvider
} = require('../utils/helpers');

const getAccountByReferralApi = (event, context, callback) => {
  const params = {
    TableName: process.env.REFERRAL_TABLE,
    Key: {
      id: event.pathParameters.id
    }
  };

  dynamoDb.get(params).promise()
    .then(result => {
      callback(null, {
        statusCode: 200,
        body: JSON.stringify(result.Item ? result.Item : {}),
      });
    })
    .catch(error => {
      console.error(error);
      callback(null, {
        statusCode: error.statusCode || 500,
        body: JSON.stringify({
          message: error.message
        })
      });
      return;
    });
};

const parseSignedMessage = (message, signedMessage) => {
  const signerAddress = ethers.utils.verifyMessage(message, signedMessage);

  const addressFromMessage = message.replace(/\n|\r/g, '').split('Wallet Address:').pop().split('Created At:')[0].trim();

  const createdAt = message.replace(/\n|\r/g, '').split('Created At:').pop().split('Code:')[0].trim();

  const code = message.replace(/\n|\r/g, '').split('Code:').pop().trim();

  return {
    signerAddress,
    addressFromMessage,
    createdAt: Number(createdAt),
    code
  }
}

const saveReferralApi = async (event, context, callback) => {
  try {
    const data = JSON.parse(event.body);

    // check required fields are received
    const invalidFields = [];
    if (!data.chain) invalidFields.push('chain');
    if (!data.message) invalidFields.push('message');
    if (!data.signedMessage) invalidFields.push('signedMessage');

    if (invalidFields.length > 0) {
      console.error('invalid data');
      callback(new Error(`${invalidFields.join(', ')} field${invalidFields.length > 1 ? 's' : ''} are invalid.`));
      return;
    }

    const { signerAddress, addressFromMessage, createdAt, code } = parseSignedMessage(data.message, data.signedMessage);

    console.log(signerAddress, addressFromMessage);

    if (signerAddress.toLowerCase() != addressFromMessage.toLowerCase()) {
      console.error(`signer ${signerAddress} didn't sign the message.`);
      callback(new Error(`signer ${signerAddress} didn't sign the message.`));
      return;
    }

    const chain = data.chain.toLowerCase();
    const smartLoanFactoryContract = new ethers.Contract(SMART_LOAN_FACTORY_TUP[chain],
                                                        SMART_LOAN_FACTORY.abi,
                                                        chain == 'arbitrum' ? arbitrumProvider : avalancheProvider);

    smartLoanAddress = await smartLoanFactoryContract.getLoanForOwner(signerAddress);

    if (!smartLoanAddress || smartLoanAddress.toLowerCase() == '0x0000000000000000000000000000000000000000') {
      console.error(`signer ${signerAddress} does not have PA account.`);
      callback(new Error(`signer ${signerAddress} does not have PA account.`));
      return;
    }

    const referralData = {
      id: code,
      createdAt,
      paAddress: smartLoanAddress,
      signerAddress
    };

    const params = {
      TableName: process.env.REFERRAL_TABLE,
      Item: referralData
    };

    dynamoDb.put(params).promise()
      .then(result => {
        callback(null, {
          statusCode: 200,
          body: JSON.stringify({
            message: 'referral saved successfully.'
          }),
          headers: {
            'Content-Type': 'application/json',
          }
        });
        return;
      })
  } catch (error) {
    console.error(error);
    callback(null, {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: error.message
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
};

module.exports = {
  getAccountByReferralApi,
  saveReferralApi
}