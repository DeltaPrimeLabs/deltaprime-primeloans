const ethers = require('ethers');
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const gmTokens = require('../config/gmTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");
const nodes = require('../.secrets/extRpc.json');
// const config = require("../../src/config");
// const key = fs.readFileSync("./.secret").toString().trim();

const avalancheHistoricalProvider = new ethers.providers.JsonRpcProvider(nodes.avalanche);

const avalancheWallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(avalancheHistoricalProvider);

// const Web3 = require('web3');
// const fs = require("fs");
const blockTimestampStart = 1707314400;
const blockTimestampEnd = 1708025000;

const factoryAddress = constants.avalanche.factory;

const getWrappedContracts = (addresses, network) => {
  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? avalancheWallet : arbitrumWallet);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

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
  //in seconds
  let timestampInSeconds = blockTimestampStart;

  let prices = {};

  for (let gmSymbol of Object.keys(gmTokens.avalanche)) {
    const resp = await redstone.getHistoricalPrice(gmSymbol, {
      startDate: (blockTimestampStart - 60 * 60 * 4) * 1000,
      interval: 60 * 60 * 4 * 1000,
      endDate: blockTimestampEnd * 1000,
      provider: "redstone"
    });

    prices[gmSymbol] = resp;
  }

  // console.log('Prices:');
  // console.log(prices);

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
    const batchSize = 200;

    const loanQualifications = {};
    let totalLeveragedGM = 0;
    let gmTvl = 0;

    // calculate gm leveraged by the loan
    for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans. ${timestampInSeconds}`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'avalanche');

      const loanStats = await Promise.all(
        wrappedContracts.map(contract => Promise.all([contract.getFullLoanStatus.call({ blockTag: blockNumber }), contract.getAllAssetsBalances.call({ blockTag: blockNumber })]))
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
    await Promise.all(
      Object.entries(loanIncentives).map(async ([loanId, value]) => {
        const data = {
          id: loanId,
          timestamp: timestampInSeconds,
          avaxCollected: value
        };

        const params = {
          TableName: process.env.GMX_INCENTIVES_AVA_RETROACTIVE_TABLE,
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );

    console.log(`GMX incentives updated for timestamp ${timestampInSeconds}.`)

    console.log(`Updated timestamp: ${timestampInSeconds}, block number: ${blockNumber}.`);

    timestampInSeconds += 60 * 60 * 4;
  }

  console.log(Object.values(prices)[0][Object.values(prices)[0].length - 1])

  return event;
}

module.exports.handler = gmxIncentivesCalculatorAvaRetroactive;

gmxIncentivesCalculatorAvaRetroactive();