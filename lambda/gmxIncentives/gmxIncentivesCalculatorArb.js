const ethers = require('ethers');
const fetch = require('node-fetch');
const {
  arbitrumProvider,
  dynamoDb,
  getWrappedContracts,
  fromWei,
  fromBytes32,
  formatUnits
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const gmTokens = require('../config/gmTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');

const factoryAddress = constants.arbitrum.factory;
const redstoneFeedUrl = constants.arbitrum.redstoneFeedUrl;

const getLatestIncentives = async () => {
  const params = {
    TableName: process.env.GMX_INCENTIVES_ARB_TABLE,
  };

  const res = await dynamoDb.scan(params).promise();

  return res.Items;
};

const gmxIncentivesCalculatorArb = async (event) => {
  const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, arbitrumProvider);
  let loanAddresses = await factoryContract.getAllLoans();
  const totalLoans = loanAddresses.length;

  const incentivesPerInterval = 10000 / (60 * 60 * 24 * 7) * (60 * 10);
  const batchSize = 50;

  const loanQualifications = {};
  let totalLeveragedGM = 0;

  // get latest incentives for loans
  const loanIncentives = {};
  const loanIncentivesArray = await getLatestIncentives();

  loanIncentivesArray.map((loan) => {
    loanIncentives[loan.id] = {};
    for (const [key, value] of Object.entries(loan)) {
      if (key != 'id') loanIncentives[loan.id][key] = value;
    }
  })

  // calculate gm leveraged by the loan
  for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
    console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

    const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
    const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'arbitrum');

    const loanStats = await Promise.all(
      wrappedContracts.map(contract => Promise.all([contract.getFullLoanStatus(), contract.getAllAssetsBalances()]))
    );

    const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
    const redstonePriceData = await redstonePriceDataRequest.json();

    if (loanStats.length > 0) {
      await Promise.all(
        loanStats.map(async (loan, batchId) => {
          const loanId = batchLoanAddresses[batchId].toLowerCase();
          const status = loan[0];
          const assetBalances = loan[1];
          const collateral = fromWei(status[0]) - fromWei(status[1]);

          loanQualifications[loanId] = {
            collateral,
            gmTokens: {},
            loanLeveragedGM: 0
          };

          let loanTotalGMValue = 0;

          await Promise.all(
            Object.entries(gmTokens.arbitrum).map(async ([symbol, token]) => {
              const price = redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0;

              const asset = assetBalances.find(asset => fromBytes32(asset.name) == symbol);
              const balance = formatUnits(asset.balance.toString(), token.decimals);

              loanQualifications[loanId].gmTokens[symbol] = balance * price;
              loanTotalGMValue += balance * price;
            })
          );

          const loanLeveragedGM = loanTotalGMValue - collateral > 0 ? loanTotalGMValue - collateral : 0;
          loanQualifications[loanId].loanLeveragedGM = loanLeveragedGM;
          totalLeveragedGM += loanLeveragedGM;
        })
      );
    }
  }

  console.log(`${Object.entries(loanQualifications).length} loans analyzed.`);

  // update incentives based on gm leveraged
  Object.entries(loanQualifications).map(([loanId, loanData]) => {
    const initIncentives = {};

    Object.entries(gmTokens.arbitrum).map(([symbol, token]) => {
      initIncentives[symbol] = 0;
    })

    const prevLoanIncentives = {
      ...initIncentives,
      ...(loanIncentives[loanId] ? loanIncentives[loanId] : {})
    }

    loanIncentives[loanId] = prevLoanIncentives;

    if (loanData.loanLeveragedGM > 0) {
      const intervalIncentivesForLoan = incentivesPerInterval * loanData.loanLeveragedGM / totalLeveragedGM;

      Object.entries(loanData.gmTokens).map(([symbol, poolGM]) => {
        loanIncentives[loanId][symbol] = Number(prevLoanIncentives[symbol]) + intervalIncentivesForLoan * poolGM / loanData.loanLeveragedGM;
      });
    }
  })

  // save/update incentives values to DB
  await Promise.all(
    Object.entries(loanIncentives).map(async ([loanId, values]) => {
      const data = {
        id: loanId,
        ...values
      };

      const params = {
        TableName: process.env.GMX_INCENTIVES_ARB_TABLE,
        Item: data
      };
      await dynamoDb.put(params).promise();
    })
  );

  console.log("GMX incentives successfully updated.")

  // save boost APY to DB
  const boostApy = incentivesPerInterval / totalLeveragedGM * 6 * 24 * 365;
  const params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "GM_BOOST"
    },
    AttributeUpdates: {
      arbApy: {
        Value: Number(boostApy) ? boostApy : null,
        Action: "PUT"
      }
    }
  };

  await dynamoDb.update(params).promise();

  console.log("GM boost APY on Arbitrum saved.");

  return event;
}

module.exports.handler = gmxIncentivesCalculatorArb;