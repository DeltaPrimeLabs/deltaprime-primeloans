const ethers = require("ethers");

const FACTORY = require(`../config/SmartLoansFactory.json`);
const LOAN = require(`../config/SmartLoanGigaChadInterface.json`);
const {
  fromWei,
  dynamoDb,
  avalancheProvider,
  arbitrumProvider,
  wrap,
  getWrappedContracts
} = require("../utils/helpers");
const networkInfo = require('../utils/constants.json');

const walletAvalanche = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(avalancheProvider);
const walletArbitrum = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(arbitrumProvider);

const factory = new ethers.Contract(networkInfo.avalanche.factory, FACTORY.abi, avalancheProvider);
const factoryArbitrum = new ethers.Contract(networkInfo.arbitrum.factory, FACTORY.abi, arbitrumProvider);

const loanAggregatorAva = async (event) => {
  console.log("fetching loans on Avalanche")

  const loanAddresses = await factory.getAllLoans();
  const batchTime = new Date().getTime();

  await Promise.all(
    loanAddresses.map(async (address) => {
      try {
        const loanContract = new ethers.Contract(address, LOAN.abi, walletAvalanche);
        const wrappedContract = wrap(loanContract, 'avalanche');
        const status = await wrappedContract.getFullLoanStatus();

        const loan = {
          id: address,
          time: batchTime,
          address: address,
          total: fromWei(status[0]),
          debt: fromWei(status[1]),
          collateral: fromWei(status[0]) - fromWei(status[1]),
          health: fromWei(status[3]),
          solvent: fromWei(status[4]) === 1e-18
        };

        const params = {
          TableName: process.env.LOAN_AVA_TABLE,
          Item: loan
        };
        await dynamoDb.put(params).promise()
      } catch(error) {
        console.log(error);
      }
    }),
  );

  console.log(`Uploaded ${loanAddresses.length} loans on Avalanche.`);

  return event;
};

const loanAggregatorArb = async (event) => {
  console.log("fetching loans on Arbitrum");

  const loanAddresses = await factoryArbitrum.getAllLoans();
  const batchTime = new Date().getTime();

  await Promise.all(
    loanAddresses.map(async (address) => {
      try {
        const loanContract = new ethers.Contract(address, LOAN.abi, walletArbitrum);
        const wrappedContract = wrap(loanContract, 'arbitrum');
        const status = await wrappedContract.getFullLoanStatus();

        const loan = {
          id: address,
          time: batchTime,
          address: address,
          total: fromWei(status[0]),
          debt: fromWei(status[1]),
          collateral: fromWei(status[0]) - fromWei(status[1]),
          health: fromWei(status[3]),
          solvent: fromWei(status[4]) === 1e-18
        };
    
        const params = {
          TableName: process.env.LOAN_ARB_TABLE,
          Item: loan
        };
        await dynamoDb.put(params).promise()
      } catch(error) {
        console.log(error);
      }
    })
  );

  console.log(`Uploaded ${loanAddresses.length} loans on Arbitrum.`);

  return event;
}


const saveLiveLoansStatusAvalanche = async () => {
  const loanAddresses = await factory.getAllLoans();
  const totalLoans = loanAddresses.length;
  const batchSize = 50;

  for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
    console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);
    const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
    const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'avalanche');

    const loanStatusResults = await Promise.all(wrappedContracts.map(contract => contract.getFullLoanStatus()));

    if (loanStatusResults.length > 0) {
      const timestamp = Date.now();
      await Promise.all(
        loanStatusResults.map(async (status, id) => {
          const loanHistoryRef = db
            .collection('loansHistory')
            .doc(batchLoanAddresses[id].toLowerCase())
            .collection('loanStatus');
          await loanHistoryRef.doc(timestamp.toString()).set({
            totalValue: fromWei(status[0]),
            borrowed: fromWei(status[1]),
            collateral: fromWei(status[0]) - fromWei(status[1]),
            twv: fromWei(status[2]),
            health: fromWei(status[3]),
            solvent: fromWei(status[4]) === 1e-18,
            timestamp
          });
        })
      );
    }
  }
}

const saveLiveLoansStatusArbitrum = async () => {
  const loanAddresses = await factoryArbitrum.getAllLoans();
  const totalLoans = loanAddresses.length;
  const batchSize = 50;

  for (let i = 0; i < Math.ceil(totalLoans/batchSize); i++) {
    console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans`);
    const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);
    const wrappedContracts = getWrappedContracts(batchLoanAddresses, 'arbitrum');

    const loanStatusResults = await Promise.all(wrappedContracts.map(contract => contract.getFullLoanStatus()));

    if (loanStatusResults.length > 0) {
      const timestamp = Date.now();
      await Promise.all(
        loanStatusResults.map(async (status, id) => {
          const loanHistoryRef = db
            .collection('loansHistoryArbitrum')
            .doc(batchLoanAddresses[id].toLowerCase())
            .collection('loanStatus');
          await loanHistoryRef.doc(timestamp.toString()).set({
            totalValue: fromWei(status[0]),
            borrowed: fromWei(status[1]),
            collateral: fromWei(status[0]) - fromWei(status[1]),
            twv: fromWei(status[2]),
            health: fromWei(status[3]),
            solvent: fromWei(status[4]) === 1e-18,
            timestamp
          });
        })
      );
    }
  }
}

module.exports = {
  loanAggregatorAva,
  loanAggregatorArb,
  saveLiveLoansStatusAvalanche,
  saveLiveLoansStatusArbitrum
}