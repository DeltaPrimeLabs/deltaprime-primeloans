const ethers = require('ethers');
const {
  dynamoDb,
  fromWei,
  getBlockForTimestamp,
  getWrappedContractsHistorical,
  getArweavePackages
} = require('../utils/helpers');
const extRpcUrl = require('../.secrets/extRpc.json');
const constants = require('../config/constants.json');
const FACTORY = require('../abis/SmartLoansFactory.json');

const blockTimestampStart = 1705297600;
const blockTimestampEnd = 1721059624;

const getHistoricalProvider = (network, rpc) => {
  return new ethers.providers.JsonRpcProvider(extRpcUrl[network])
};

const getFactoryContract = (network, provider) => {
  const factoryAddress = constants[network].factory;
  const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

  return factoryContract;
}

let timestampInSeconds = blockTimestampStart;

const getHistoricalLoanStatsArb = async (network = 'arbitrum', rpc = 'first') => {
  try {
    const provider = getHistoricalProvider(network, rpc);
    const factoryContract = getFactoryContract(network, provider);

    while (timestampInSeconds <= blockTimestampEnd) {
      console.log(`Processed timestamp: ${timestampInSeconds}`)

      const packages = await getArweavePackages(timestampInSeconds, network);
      const blockNumber = (await getBlockForTimestamp(network, timestampInSeconds * 1000)).block;

      const loanAddresses = await factoryContract.getAllLoans({ blockTag: blockNumber });
      const totalLoans = loanAddresses.length;
      console.log(`${totalLoans} loans found`);

      const batchSize = 200;
      const loanStats = {};

      for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
        console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);
        const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);

        const wrappedContracts = await getWrappedContractsHistorical(batchLoanAddresses, network, packages)

        async function runMethod(contract, methodName, blockNumber) {
          const tx = await contract.populateTransaction[methodName]()
          let res = await contract.signer.call(tx, blockNumber)
          return contract.interface.decodeFunctionResult(
            methodName,
            res
          )[0];
        }

        const loanStatusResults = await Promise.all(wrappedContracts.map(contract => runMethod(contract, 'getFullLoanStatus', blockNumber)));

        if (loanStatusResults.length > 0) {
          loanStatusResults.map(async (status, id) => {
            loanStats[batchLoanAddresses[id]] = {
              totalValue: fromWei(status[0]),
              borrowed: fromWei(status[1]),
              collateral: fromWei(status[0]) - fromWei(status[1]),
              twv: fromWei(status[2]),
              health: fromWei(status[3]),
              solvent: fromWei(status[4]) === 1e-18,
              timestamp: timestampInSeconds * 1000
            };
          });
        }
      }

      // save loan stats to DB
      await Promise.all(
        Object.entries(loanStats).map(async ([loanId, stats]) => {
          const data = {
            id: loanId.toLowerCase(),
            ...stats
          };

          const params = {
            TableName: "loan-stats-arb-prod",
            Item: data
          };
          await dynamoDb.put(params).promise();
        })
      );

      timestampInSeconds += 60 * 60 * 24 * 3; // 1 day
    }
  } catch (error) {
    console.log(error);
    getHistoricalLoanStatsArb('arbitrum', rpc == 'first' ? 'second' : 'first');
  }
}

getHistoricalLoanStatsArb('arbitrum', 'first');