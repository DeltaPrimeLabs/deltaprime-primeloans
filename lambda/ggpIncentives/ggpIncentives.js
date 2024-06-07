const ethers = require('ethers');
const fetch = require('node-fetch');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const ggpTokens = require('../config/ggpTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');

const factoryAddress = constants.avalanche.factory;
const redstoneFeedUrl = constants.avalanche.redstoneFeedUrl;
const avalancheHistoricalProvider = new ethers.providers.JsonRpcProvider('https://nd-033-589-713.p2pify.com/d41fdf9956747a40bae4edec06ad4ab9/ext/bc/C/rpc');

const avalancheWallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(avalancheHistoricalProvider);

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

const getIncentivesMultiplier = async (now) => {
  const params = {
    TableName: "ggp-incentives-ava-prod",
  };

  const res = await fetchAllDataFromDB(params, true);

  if (res.length == 0) return 1;

  res.sort((a, b) => b.timestamp - a.timestamp);

  return Math.round((now - res[0].timestamp) / 3600);
};

const ggpIncentives = async () => {
  const now = Math.floor(Date.now() / 1000);
  const incentivesPerWeek = 1250;
  const incentivesMultiplier = await getIncentivesMultiplier(now);

  if (incentivesMultiplier == 0) return;

  try {
    const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, avalancheHistoricalProvider);
    let loanAddresses = await factoryContract.getAllLoans();
    const totalLoans = loanAddresses.length;

    const incentivesPerInterval = incentivesPerWeek / (60 * 60 * 24 * 7) * (60 * 60) * incentivesMultiplier;
    const batchSize = 150;

    const loanQualifications = {};
    let totalEligibleTvl = 0;
    let gmTvl = 0;

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
      console.log(redstonePriceData['ggAVAX']);

      if (loanStats.length > 0) {
        await Promise.all(
          loanStats.map(async (loan, batchId) => {
            const loanId = batchLoanAddresses[batchId].toLowerCase();
            const status = loan[0];
            const assetBalances = loan[1];
            const collateral = fromWei(status[0]) - fromWei(status[1]);

            loanQualifications[loanId] = {
              collateral,
              ggpTokens: {},
              eligibleTvl: 0
            };

            let loanggAvaxValue = 0;

            await Promise.all(
              Object.entries(ggpTokens.avalanche).map(async ([symbol, tokenConfig]) => {
                const price = redstonePriceData[symbol] ? redstonePriceData[symbol][0].dataPoints[0].value : 0;

                const asset = assetBalances.find(asset => fromBytes32(asset.name) == symbol);
                const balance = formatUnits(asset.balance.toString(), tokenConfig.decimals);

                loanQualifications[loanId].ggpTokens[symbol] = balance * price;
                loanggAvaxValue += balance * price;
              })
            );

            const eligibleTvl = loanggAvaxValue - collateral > 0 ? loanggAvaxValue - collateral : 0;
            loanQualifications[loanId].eligibleTvl = eligibleTvl;
            totalEligibleTvl += eligibleTvl;
            gmTvl += loanggAvaxValue;
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
    // await Promise.all(
    //   Object.entries(loanIncentives).map(async ([loanId, value]) => {
    //     const data = {
    //       id: loanId,
    //       timestamp: now,
    //       avaxCollected: value
    //     };

    //     const params = {
    //       TableName: "ggp-incentives-ava-prod",
    //       Item: data
    //     };
    //     await dynamoDb.put(params).promise();
    //   })
    // );

    // console.log("GGP incentives successfully updated.")

    // save boost APY to DB
    const boostApy = (incentivesPerInterval / incentivesMultiplier) / totalEligibleTvl * 24 * 365;
    console.log('boost APY', boostApy);
    // const params = {
    //   TableName: "statistics-prod",
    //   Key: {
    //     id: "GGP_ggAVAX"
    //   },
    //   AttributeUpdates: {
    //     boostApy: {
    //       Value: Number(boostApy) ? boostApy : null,
    //       Action: "PUT"
    //     }
    //   }
    // };

    // await dynamoDb.update(params).promise();

    console.log("GGP boost APY on Avalanche saved.");
  } catch (error) {
    console.log('Error', error);
  }
}

ggpIncentives();