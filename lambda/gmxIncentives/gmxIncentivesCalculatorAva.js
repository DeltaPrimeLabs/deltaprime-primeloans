const ethers = require('ethers');
const fetch = require('node-fetch');
const {
  avalancheProvider,
  dynamoDb,
  getWrappedContracts,
  fromWei,
  fromBytes32,
  formatUnits
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const gmTokens = require('../config/gmTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');

const factoryAddress = constants.avalanche.factory;
const redstoneFeedUrl = constants.avalanche.redstoneFeedUrl;

const getLatestIncentives = async () => {
  const params = {
    TableName: process.env.GMX_INCENTIVES_AVA_TABLE,
  };

  const res = await dynamoDb.scan(params).promise();

  return res.Items;
};

const gmxIncentivesCalculatorAva = async (event) => {
  const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, avalancheProvider);
  let loanAddresses = await factoryContract.getAllLoans();
  const totalLoans = loanAddresses.length;

  const incentivesPerInterval = 1500 / (60 * 60 * 24 * 7) * (60 * 10);
  const batchSize = 50;

  const loanQualifications = {};
  let totalLeveragedGM = 0;
  let gmTvl = 0;

  // get latest incentives for loans
  const loanIncentives = {};
  const loanIncentivesArray = await getLatestIncentives();

  loanIncentivesArray.map((loan) => {
    loanIncentives[loan.id] = loan.avaxCollected;
  })

  // calculate gm leveraged by the loan
  for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
    console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

    const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
    const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'avalanche');

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
            Object.entries(gmTokens.avalanche).map(async ([symbol, token]) => {
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
          gmTvl += loanTotalGMValue;
        })
      );
    }
  }

  console.log(`${Object.entries(loanQualifications).length} loans analyzed.`);

  // update incentives based on gm leveraged
  Object.entries(loanQualifications).map(([loanId, loanData]) => {
    const prevLoanIncentives = loanIncentives[loanId] ? loanIncentives[loanId] : 0;

    loanIncentives[loanId] = prevLoanIncentives;

    if (loanData.loanLeveragedGM > 0) {
      const intervalIncentivesForLoan = incentivesPerInterval * loanData.loanLeveragedGM / totalLeveragedGM;

      loanIncentives[loanId] = Number(prevLoanIncentives) + intervalIncentivesForLoan;
    }
  })

  // save/update incentives values to DB
  await Promise.all(
    Object.entries(loanIncentives).map(async ([loanId, value]) => {
      const data = {
        id: loanId,
        avaxCollected: value
      };

      const params = {
        TableName: process.env.GMX_INCENTIVES_AVA_TABLE,
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
      avaxApy: {
        Value: Number(boostApy) ? boostApy : null,
        Action: "PUT"
      },
      avaxTvl: {
        Value: Number(gmTvl) ? gmTvl : null,
        Action: "PUT"
      }
    }
  };

  await dynamoDb.update(params).promise();

  console.log("GM boost APY on Avalanche saved.");

  return event;
}

module.exports.handler = gmxIncentivesCalculatorAva;