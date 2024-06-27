const ethers = require('ethers');
const {
  dynamoDb,
  fromWei,
  avalancheHistoricalProvider,
  getWrappedContractsHistorical,
  getArweavePackages
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const EthDater = require("ethereum-block-by-date");

const blockTimestampStart = 1696224800;
const blockTimestampEnd = 1719250276;

const avalancheFactoryAddress = constants.avalanche.factory;

const getBlockForTimestamp = async (timestamp) => {
  const dater = new EthDater(
    avalancheHistoricalProvider // ethers provider, required.
  );

  return await dater.getDate(
    timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  );
}

const sPrimeAirdropBorrowerAva = async (chain = 'avalanche') => {
  let timestampInSeconds = blockTimestampStart;

  while (timestampInSeconds <= blockTimestampEnd) {
    console.log(`Processed timestamp: ${timestampInSeconds}`)
    const packages = await getArweavePackages(timestampInSeconds);

    const blockNumber = (await getBlockForTimestamp(timestampInSeconds * 1000)).block;
    const factoryContract = new ethers.Contract(avalancheFactoryAddress, FACTORY.abi, avalancheHistoricalProvider);
    let loanAddresses = await factoryContract.getAllLoans({ blockTag: blockNumber });
    const totalLoans = loanAddresses.length;

    const batchSize = 200;
    const loanDebts = {};

    for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
      console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans. ${timestampInSeconds}`);

      const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
      const wrappedContracts = await getWrappedContractsHistorical(batchLoanAddresses, chain, packages)

      async function runMethod(contract, methodName, blockNumber) {
        const tx = await contract.populateTransaction[methodName]()
        let res = await contract.signer.call(tx, blockNumber)
        return contract.interface.decodeFunctionResult(
          methodName,
          res
        )[0];
      }

      const loanStats = await Promise.all(
        wrappedContracts.map(contract => runMethod(contract, 'getFullLoanStatus', blockNumber))
      );

      if (loanStats.length > 0) {
        loanStats.map(async (loanStat, batchId) => {
          const loanId = batchLoanAddresses[batchId].toLowerCase();
          const debt = fromWei(loanStat[1]);

          loanDebts[loanId] = debt;
        })
      }
    }

    // save/update incentives values to DB
    await Promise.all(
      Object.entries(loanDebts).map(async ([loanId, value]) => {
        const data = {
          id: loanId,
          timestamp: timestampInSeconds,
          debt: value
        };

        const params = {
          TableName: 'sprime-airdrop-borrower-ava',
          Item: data
        };
        await dynamoDb.put(params).promise();
      })
    );

    timestampInSeconds += 60 * 60 * 24 * 7;
    await new Promise((resolve, reject) => setTimeout(resolve, 5000));
  }
}

sPrimeAirdropBorrowerAva('avalanche');