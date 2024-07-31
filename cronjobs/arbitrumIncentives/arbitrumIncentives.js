const ethers = require('ethers');
const fetch = require('node-fetch');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
  fetchAllDataFromDB,
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');
const extRpcUrl = require('../.secrets/extRpc.json');
const pingUrl = require('../.secrets/ping.json');
const incentivesRpcUrl = require('../.secrets/incentivesRpc.json');

const factoryAddress = constants.arbitrum.factory;
const getHistoricalProvider = (rpc) => {
  // return new ethers.providers.JsonRpcProvider(incentivesRpcUrl.arbitrum[rpc])
  return new ethers.providers.JsonRpcProvider(extRpcUrl.arbitrum)
};

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

const getWrappedContracts = (addresses, network, provider) => {
  const arbitrumWallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
    .connect(provider);

  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? avalancheWallet : arbitrumWallet);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

const getIncentivesMultiplier = async (now) => {
  const params = {
    TableName: "arbitrum-incentives-arb-prod",
  };

  const res = await fetchAllDataFromDB(params, true);

  if (res.length == 0) return 1;

  res.sort((a, b) => b.timestamp - a.timestamp);

  return Math.round((now - res[0].timestamp) / 3600);
};

let retryTime = 0;

const arbitrumIncentives = async (rpc = 'first') => {
  const now = Math.floor(Date.now() / 1000);
  const incentivesPerWeek = 80000;
  const incentivesMultiplier = await getIncentivesMultiplier(now);

  if (incentivesMultiplier == 0) return;

  try {
    const provider = getHistoricalProvider(rpc);
    const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, provider);
    let loanAddresses = await factoryContract.getAllLoans();
    const totalLoans = loanAddresses.length;

    const incentivesPerInterval = incentivesPerWeek / (60 * 60 * 24 * 7) * (60 * 60) * incentivesMultiplier;
    const batchSize = 150;

    const loanQualifications = {};
    let totalEligibleTvl = 0;

    // calculate eligible tvl leveraged by the loan
    for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'arbitrum', provider);

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

      // wait 1 second for stability
      await new Promise((resolve, reject) => setTimeout(resolve, 1000));
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
    const boostApy = (incentivesPerInterval / incentivesMultiplier) / totalEligibleTvl * 24 * 365;
    let params = {
      TableName: "statistics-prod",
      Key: {
        id: "LTIP_LOAN"
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

    // save total incentives to DB
    params = {
      TableName: "arbitrum-incentives-arb-prod"
    };

    const incentives = await fetchAllDataFromDB(params, true);

    let accumulatedIncentives = 0;

    incentives.map((item) => {
      accumulatedIncentives += item.arbCollected ? Number(item.arbCollected) : 0;
    });

    params = {
      TableName: "statistics-prod",
      Key: {
        id: "LTIP_LOAN"
      },
      AttributeUpdates: {
        totalArb: {
          Value: Number(accumulatedIncentives) ? accumulatedIncentives : null,
          Action: "PUT"
        }
      }
    };

    await dynamoDb.update(params).promise();
    console.log("LTIP Loan total ARB saved.");

    // save/update incentives values to DB
    const data = {
      id: now,
      totalEligibleTvl
    };

    params = {
      TableName: "loan-eligible-tvl-arb-prod",
      Item: data
    };

    await dynamoDb.put(params).promise();
    console.log("LTIP Loan total eligible tvl saved.");

    // ping healthcheck end point
    await fetch(pingUrl.ltipPA.success);
  } catch (error) {
    console.log('Error', error);

    if (error.error.code == 'SERVER_ERROR' || error.error.code == 'TIMEOUT') {
      retryTime += 1;

      if (retryTime === 3) {
        await fetch(pingUrl.ltipPA.fail, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error,
            message: "function retried 3 times and failed yet."
          })
        });
      }

      arbitrumIncentives(rpc == "first" ? "second" : "first");
    } else {
      await fetch(pingUrl.ltipPA.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error,
          message: "function terminated."
        })
      });
    }
  }
}

arbitrumIncentives();