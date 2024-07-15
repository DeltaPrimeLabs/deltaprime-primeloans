const ethers = require('ethers');
const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const {
  dynamoDb,
  fromWei
} = require('../utils/helpers');
const incentivesRpcUrl = require('../.secrets/incentivesRpc.json');
const constants = require('../config/constants.json');

const LOAN = require(`../abis/SmartLoanGigaChadInterface.json`);
const FACTORY = require('../abis/SmartLoansFactory.json');
const CACHE_LAYER_URLS = require('../config/redstone-cache-layer-urls.json');

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

const saveLiveLoansStatusAvalanche = async (network = 'avalanche', rpc = 'first') => {
  try {
    const now = Date.now();
    const provider = getHistoricalProvider(network, rpc);
    const factoryContract = getFactoryContract(network, provider);

    const loanAddresses = await factoryContract.getAllLoans();
    const totalLoans = loanAddresses.length;
    console.log(`${totalLoans} loans found`);

    const batchSize = 100;
    const loanStats = {};

    for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);
      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      const wrappedContracts = getWrappedContracts(batchLoanAddresses, network, provider);

      const loanStatusResults = await Promise.all(wrappedContracts.map(contract => contract.getFullLoanStatus()));

      if (loanStatusResults.length > 0) {
        loanStatusResults.map(async (status, id) => {
          loanStats[batchLoanAddresses[id]] = {
            totalValue: fromWei(status[0]),
            borrowed: fromWei(status[1]),
            collateral: fromWei(status[0]) - fromWei(status[1]),
            twv: fromWei(status[2]),
            health: fromWei(status[3]),
            solvent: fromWei(status[4]) === 1e-18,
            timestamp: now
          };
        });
      }
    }

    // save loan stats to DB
    await Promise.all(
      Object.entries(loanStats).map(async ([loanId, stats]) => {
        const data = {
          id: loanId,
          ...stats
        };

        const params = {
          TableName: "loan-stats-ava-prod",
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );
  } catch (error) {
    console.log(error);
    saveLiveLoansStatusAvalanche('avalanche', rpc == "first" ? "second" : "first");
  }
}

saveLiveLoansStatusAvalanche('avalanche', 'first');