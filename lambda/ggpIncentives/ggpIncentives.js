const ethers = require('ethers');
const fetch = require('node-fetch');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
  fetchAllDataFromDB
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const ggpTokens = require('../config/ggpTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');
const pingUrl = require('../.secrets/ping.json');
const incentivesRpcUrl = require('../.secrets/incentivesRpc.json');

const redstoneFeedUrl = constants.avalanche.redstoneFeedUrl;

const getHistoricalProvider = (network, rpc) => {
  return new ethers.providers.JsonRpcProvider(incentivesRpcUrl[network][rpc])
};

const getFactoryContract = (network, provider) => {
  const factoryAddress = constants[network].factory;
  const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

  return factoryContract;
}


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
  const wallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
    .connect(provider);
  
  return addresses.map(address => {
    const loanContract = new ethers.Contract(address, LOAN.abi, wallet);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

const getIncentivesMultiplier = async (now) => {
  const params = {
    TableName: "ggp-incentives-ava-prod",
  };

  const res = await fetchAllDataFromDB(params, true);

  if (res.length == 0) return 1;

  res.sort((a, b) => b.timestamp - a.timestamp);

  return Math.round((now - res[0].timestamp) / 3600);
};

const ggpIncentives = async (network = 'avalanche', rpc = 'first') => {
  const now = Math.floor(Date.now() / 1000);
  const incentivesPerWeek = 125;
  const incentivesMultiplier = await getIncentivesMultiplier(now);

  if (incentivesMultiplier == 0) return;

  try {
    const provider = getHistoricalProvider(network, rpc);
    const factoryContract = getFactoryContract(network, provider);
    let loanAddresses = await factoryContract.getAllLoans();
    const totalLoans = loanAddresses.length;

    const incentivesPerInterval = incentivesPerWeek / (60 * 60 * 24 * 7) * (60 * 60) * incentivesMultiplier;
    const batchSize = 150;

    const loanQualifications = {};
    let totalEligibleTvl = 0;

    // calculate eligible ggAVAX of loan
    for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      const wrappedContracts = getWrappedContracts(batchLoanAddresses, network, provider);

      const loanStats = await Promise.all(
        wrappedContracts.map(contract => Promise.all([contract.getFullLoanStatus(), contract.ggAvaxBalanceAvaxGgavax()]))
      );

      const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
      const redstonePriceData = await redstonePriceDataRequest.json();

      if (loanStats.length > 0) {
        await Promise.all(
          loanStats.map(async (loan, batchId) => {
            const loanId = batchLoanAddresses[batchId].toLowerCase();
            const status = loan[0];
            const collateral = fromWei(status[0]) - fromWei(status[1]);

            const ggAvaxBalance = formatUnits(loan[1]);
            const ggAvaxPrice = redstonePriceData['WOMBAT_ggAVAX_AVAX_LP_ggAVAX'] ? redstonePriceData['WOMBAT_ggAVAX_AVAX_LP_ggAVAX'][0].dataPoints[0].value : 0;
            const loanggAvaxValue = ggAvaxBalance * ggAvaxPrice;

            const eligibleTvl = loanggAvaxValue - collateral > 0 ? loanggAvaxValue - collateral : 0;

            loanQualifications[loanId] = {
              eligibleTvl
            };

            totalEligibleTvl += eligibleTvl;
          })
        );
      }
    }

    console.log(`${Object.entries(loanQualifications).length} loans analyzed.`);

    // incentives of all loans
    const loanIncentives = {};

    Object.entries(loanQualifications).map(([loanId, loanData]) => {
      loanIncentives[loanId] = 0;

      if (loanData.eligibleTvl > 0) {
        loanIncentives[loanId] = incentivesPerInterval * loanData.eligibleTvl / totalEligibleTvl;
      }
    })

    // save/update incentives values to DB
    await Promise.all(
      Object.entries(loanIncentives).map(async ([loanId, value]) => {
        const data = {
          id: loanId,
          timestamp: now,
          ggpCollected: value
        };

        const params = {
          TableName: "ggp-incentives-ava-prod",
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );

    console.log("GGP incentives successfully updated.")

    // save boost APY to DB
    const boostApy = totalEligibleTvl > 0 ? (incentivesPerInterval / incentivesMultiplier) / totalEligibleTvl * 24 * 365 : 0;

    const params = {
      TableName: "statistics-prod",
      Key: {
        id: "GGP_ggAVAX"
      },
      AttributeUpdates: {
        boostApy: {
          Value: Number(boostApy) ? boostApy : null,
          Action: "PUT"
        }
      }
    };

    await dynamoDb.update(params).promise();

    console.log("GGP boost APY on Avalanche saved.");

    // ping healthcheck end point
    await fetch(pingUrl.ggp.success);
  } catch (error) {
    console.log('Error', error);

    if (error.error.code == 'SERVER_ERROR' || error.error.code == 'TIMEOUT') {
      await fetch(pingUrl.ggp.fail, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error,
          message: "retrying the function."
        })
      });
      ggpIncentives('avalanche', 'second');
    } else {
      await fetch(pingUrl.ggp.fail, {
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

ggpIncentives('avalanche', 'first');