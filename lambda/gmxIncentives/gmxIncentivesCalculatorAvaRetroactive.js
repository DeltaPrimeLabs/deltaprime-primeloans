const ethers = require('ethers');
const fetch = require('node-fetch');
const {
  avalancheProvider,
  dynamoDb,
  getWrappedContracts,
  fromWei,
  fromBytes32,
  formatUnits,
  avalancheHistoricalProvider
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const gmTokens = require('../config/gmTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");
const fs = require("fs");
import {getWrappedContractsHistorical} from "../utils/helpers";

// const config = require("../../src/config");
// const key = fs.readFileSync("./.secret").toString().trim();

// const Web3 = require('web3');
// const fs = require("fs");
const blockTimestampStart = 1707314400;
const blockTimestampEnd = 1707919200;// 1708002000;

const factoryAddress = constants.avalanche.factory;

const getBlockForTimestamp = async (timestamp) => {
  const dater = new EthDater(
    avalancheHistoricalProvider // ethers provider, required.
  );

  return await dater.getDate(
    timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  );
}

const gmxIncentivesCalculatorAvaRetroactive = async (event) => {
  let json = JSON.parse(fs.readFileSync('avax-epoch-1-test.json'));
  if (!json) json = {};
  //in seconds
  let timestampInSeconds = blockTimestampStart;

  let prices = {};

  for (let gmSymbol of Object.keys(gmTokens.avalanche)) {
    const resp = await redstone.getHistoricalPrice(gmSymbol, {
      startDate: (blockTimestampStart - 4 * 60 * 60) * 1000,
      interval: 4 * 60 * 60 * 1000,
      endDate: blockTimestampEnd * 1000,
      provider: "redstone"
    });

    prices[gmSymbol] = resp;
  }


  while (timestampInSeconds <= blockTimestampEnd) {
    console.log(`Processed timestamp: ${timestampInSeconds}`)
    let blockNumber = (await getBlockForTimestamp(timestampInSeconds * 1000)).block;
    const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, avalancheHistoricalProvider);

    let loanAddresses = await factoryContract.getAllLoans({ blockTag: blockNumber });
    const totalLoans = loanAddresses.length;

    let weeklyIncentives;
    if (timestampInSeconds < 1707469800) {// 09.02.2024 10:10 CET
      weeklyIncentives = 333.333;
    } else if (timestampInSeconds < 1707568800) {// 10.02.2024 13:40 CET
      weeklyIncentives = 833.333;
    } else {
      weeklyIncentives = 1500;
    }
    const incentivesPerInterval = weeklyIncentives / (60 * 60 * 24 * 7) * (60 * 60 * 4);
    const batchSize = 50;

    const loanQualifications = {};
    let totalLeveragedGM = 0;
    let gmTvl = 0;

    // calculate gm leveraged by the loan
    for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans. ${timestampInSeconds}`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);

      const wrappedContracts = await getWrappedContractsHistorical(batchLoanAddresses, 'avalanche', timestampInSeconds)

      async function runMethod(contract, methodName, blockNumber) {
        const tx = await contract.populateTransaction[methodName]()
        let res = await contract.signer.call(tx, blockNumber)
        return contract.interface.decodeFunctionResult(
            methodName,
            res
        )[0];
      }

      const loanStats = await Promise.all(
        wrappedContracts.map(contract => Promise.all([
          runMethod(contract, 'getFullLoanStatus', blockNumber),
          runMethod(contract, 'getAllAssetsBalances', blockNumber)
        ])));


      if (loanStats.length > 0) {
        console.log(`loanStats: ${loanStats.length}, timestamp: ${Date.now()}`)
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
                let price;

                if (prices[symbol]) {
                  let i = 0;
                  while (!price) {
                    price = prices[symbol].find(price => Math.abs(Number(price.timestamp) - timestampInSeconds * 1000) <= 70 * 1000)
                    i++;
                  }
                }

                const asset = assetBalances.find(asset => fromBytes32(asset.name) == symbol);
                const balance = formatUnits(asset.balance.toString(), token.decimals);

                loanQualifications[loanId].gmTokens[symbol] = balance * price.value;
                loanTotalGMValue += balance * price.value;
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

    // incentives of all loans
    const loanIncentives = {};

    Object.entries(loanQualifications).map(([loanId, loanData]) => {
      loanIncentives[loanId] = 0;

      if (loanData.loanLeveragedGM > 0) {
        const intervalIncentivesForLoan = incentivesPerInterval * loanData.loanLeveragedGM / totalLeveragedGM;

        loanIncentives[loanId] = intervalIncentivesForLoan;
      }
    })

    // save/update incentives values to DB

    Object.entries(loanIncentives).forEach(([loanId, value]) => {
      if (json[loanId]) {json[loanId] += value} else {json[loanId] = value};
    })

    fs.writeFileSync('avax-epoch-1-test.json', JSON.stringify(json))

    console.log(`GMX incentives updated for timestamp ${timestampInSeconds}.`)

    console.log(`Updated timestamp: ${timestampInSeconds}, block number: ${blockNumber}.`);

    timestampInSeconds += 4 * 60 * 60;
  }

  console.log(`GM boost APY on avalanche updated from ${blockTimestampStart} to ${blockTimestampEnd}.`);

  console.log(Object.values(prices)[0][Object.values(prices)[0].length - 1])

  return event;
}

gmxIncentivesCalculatorAvaRetroactive().then()