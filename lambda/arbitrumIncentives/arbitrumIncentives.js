const ethers = require('ethers');
const fetch = require('node-fetch');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');
const extRpcUrl = require('../.secrets/extRpc.json');
const pingUrl = require('../.secrets/ping.json');

const factoryAddress = constants.arbitrum.factory;
const arbitrumHistoricalProvider = new ethers.providers.JsonRpcProvider(extRpcUrl.arbitrum);

const arbitrumWallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(arbitrumHistoricalProvider);

const wrap = (contract, network) => {
  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: `redstone-${network}-prod`,
      uniqueSignersCount: 3,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
}

const getWrappedContracts = (addresses, network) => {
  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? avalancheWallet : arbitrumWallet);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

const arbitrumIncentives = async () => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, arbitrumHistoricalProvider);
    let loanAddresses = await factoryContract.getAllLoans();
    const totalLoans = loanAddresses.length;

    const incentivesPerInterval = 100 / (60 * 60 * 24 * 7) * (60 * 60);
    const batchSize = 150;

    const loanQualifications = {};
    let totalEligibleTvl = 0;

    // calculate eligible tvl leveraged by the loan
    for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'arbitrum');

      const loanStats = await Promise.all(
        wrappedContracts.map(contract => contract.getLTIPEligibleTVL())
      );

      if (loanStats.length > 0) {
        await Promise.all(
          loanStats.map(async (eligibleTvl, batchId) => {
            const loanId = batchLoanAddresses[batchId].toLowerCase();
            const loanEligibleTvl = formatUnits(eligibleTvl);

            loanQualifications[loanId] = {
              loanEligibleTvl: 0
            };

            loanQualifications[loanId].loanEligibleTvl = Number(loanEligibleTvl);
            totalEligibleTvl += Number(loanEligibleTvl);
          })
        );
      }
    }

    console.log(`${Object.entries(loanQualifications).length} loans analyzed.`);

    // incentives of all loans
    const loanIncentives = {};

    Object.entries(loanQualifications).map(([loanId, loanData]) => {
      loanIncentives[loanId] = 0;

      if (loanData.loanEligibleTvl > 0) {
        loanIncentives[loanId] = incentivesPerInterval * loanData.loanEligibleTvl / totalEligibleTvl;
      }
    })

    // save/update incentives values to DB
    await Promise.all(
      Object.entries(loanIncentives).map(async ([loanId, value]) => {
        const data = {
          id: loanId,
          timestamp: now,
          arbCollected: value
        };

        const params = {
          TableName: "arbitrum-incentives-arb-prod",
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );

    console.log("Arbitrum incentives successfully updated.")

    // save loan Eligible Tvl to DB
    await Promise.all(
      Object.entries(loanQualifications).map(async ([loanId, loanData]) => {
        const data = {
          id: loanId,
          eligibleTvl: loanData.loanEligibleTvl
        };

        const params = {
          TableName: "loans-arb-prod",
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );

    console.log("Loan eligible TVLs successfully updated.");

    // save boost APY to DB
    const boostApy = incentivesPerInterval / totalEligibleTvl * 24 * 365;
    const params = {
      TableName: "apys-prod",
      Key: {
        id: "LTIP_BOOST"
      },
      AttributeUpdates: {
        arbApy: {
          Value: Number(boostApy) ? boostApy : null,
          Action: "PUT"
        },
        totalEligibleTvl: {
          Value: Number(totalEligibleTvl) ? totalEligibleTvl : null,
          Action: "PUT"
        }
      }
    };

    await dynamoDb.update(params).promise();
    console.log("LTIP boost APY on Arbitrum saved.");

    // ping healthcheck end point
    await fetch(pingUrl.ltipPA.success);
  } catch (error) {
    console.log('Error', error);

    await fetch(pingUrl.ltipPA.fail, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(error)
    });
  }
}

arbitrumIncentives();