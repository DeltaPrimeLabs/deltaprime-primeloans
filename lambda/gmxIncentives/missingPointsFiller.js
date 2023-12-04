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
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");
const config = require("../../src/config");
const key = fs.readFileSync("./.secret").toString().trim();

const Web3 = require('web3');
const fs = require("fs");

let provider = new ethers.providers.JsonRpcProvider('https://arbitrum-mainnet.core.chainstack.com/79a835e86be634e1e02f7bfd107763b9');

const factoryAddress = constants.arbitrum.factory;

const getLatestIncentives = async () => {
  const params = {
    TableName: process.env.GMX_INCENTIVES_ARB_TABLE,
  };

  const res = await dynamoDb.scan(params).promise();

  return res.Items;
};

const getBlockForTimestamp = async (timestamp) => {
    const dater = new EthDater(
        provider // ethers provider, required.
    );

    return await dater.getDate(
        timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
        true // Block after, optional. Search for the nearest block before or after the given date. By default true.
    );
}

const missingPointsFiller = async (event) => {
 //in seconds
  let timestampInSeconds = event.blockTimestampStart;

    let prices = {};

    for (let gmSymbol of Object.keys(gmTokens.arbitrum)) {
        const resp = await redstone.getHistoricalPrice(gmSymbol, {
            startDate: event.blockTimestampStart * 1000,
            interval: 10 * 60 * 1000,
            endDate: event.blockTimestampEnd * 1000,
            provider: "redstone"
        });

        prices[gmSymbol] = resp;
    }

    console.log('Prices:');
    console.log(prices);

    while (timestampInSeconds <= event.blockTimestampEnd) {
      console.log(`Processed timestamp: ${timestampInSeconds}`)
      let blockNumber = (await getBlockForTimestamp(timestampInSeconds * 1000)).block;
      const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, arbitrumProvider);
      let loanAddresses = await factoryContract.getAllLoans({ blockTag:  blockNumber});
      const totalLoans = loanAddresses.length;

      const incentivesPerInterval = 10000 / (60 * 60 * 24 * 7) * (60 * 10);
      const batchSize = 50;

      const loanQualifications = {};
      let totalLeveragedGM = 0;
      let gmTvl = 0;

      // get latest incentives for loans
      const loanIncentives = {};
      const loanIncentivesArray = await getLatestIncentives();

      loanIncentivesArray.map((loan) => {
          loanIncentives[loan.id] = loan.arbCollected;
      })

      // calculate gm leveraged by the loan
      for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
          console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

          const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
          const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'arbitrum');

          const loanStats = await Promise.all(
              wrappedContracts.map(contract => Promise.all([contract.getFullLoanStatus({blockTag: blockNumber}), contract.getAllAssetsBalances({blockTag: blockNumber})]))
          );

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
                              let price = 0;

                              if (prices[symbol]) {
                                  let i = 0;
                                  while (!price) {
                                      price = prices[symbol].find(price => price.timestamp === timestampInSeconds * 1000)
                                      i++;
                                  }
                              }

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
                  arbCollected: value
              };

              const params = {
                  TableName: process.env.GMX_INCENTIVES_ARB_TABLE,
                  Item: data
              };
              await dynamoDb.put(params).promise();
          })
      );

      console.log(`GMX incentives updated for timestamp ${timestampInSeconds}.`)

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
              },
              tvl: {
                  Value: Number(gmTvl) ? gmTvl : null,
                  Action: "PUT"
              }
          }
      };

      await dynamoDb.update(params).promise();

       console.log(`Updated timestamp: ${timestampInSeconds}, block number: ${blockNumber}.`);

      timestampInSeconds += 10 * 60;
    }

    console.log(`GM boost APY on Arbitrum updated from ${event.blockTimestampStart} to ${event.blockTimestampEnd}.`);

    return event;
}

module.exports.handler = missingPointsFiller;