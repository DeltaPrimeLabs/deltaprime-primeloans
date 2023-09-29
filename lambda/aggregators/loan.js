

module.exports.scheduledFunctionAvalanche = async (event) => {
  console.log("fetching loans on Avalanche")

  const loanAddresses = await factory.getAllLoans();
  const batchTime = new Date().getTime();

  await Promise.all(
    loanAddresses.map(async (address) => {
      try {
        const loanContract = new ethers.Contract(address, LOAN.abi, wallet);
        const wrappedContract = wrap(loanContract, 'avalanche');
        const status = await wrappedContract.getFullLoanStatus();

        const loan = {
          time: batchTime,
          address: address,
          total: fromWei(status[0]),
          debt: fromWei(status[1]),
          collateral: fromWei(status[0]) - fromWei(status[1]),
          health: fromWei(status[3]),
          solvent: fromWei(status[4]) === 1e-18
        };

        await db.collection('loans').doc(address).set(loan);
      } catch(error) {
        console.log(error);
      }
    }),
  );

  functions.logger.info(`Uploaded ${loanAddresses.length} loans.`);

  return event;
};

module.exports.scheduledFunctionArbitrum = async (event) => {
  console.log("fetching loans on Arbitrum");

  const loanAddressesArbitrum = await factoryArbitrum.getAllLoans();
  const batchTime = new Date().getTime();

  await Promise.all(
    loanAddressesArbitrum.map(async (address) => {
      try {
        const loanContract = new ethers.Contract(address, LOAN.abi, walletArbitrum);
        const wrappedContract = wrap(loanContract, 'arbitrum');
        const status = await wrappedContract.getFullLoanStatus();

        const loan = {
          time: batchTime,
          address: address,
          total: fromWei(status[0]),
          debt: fromWei(status[1]),
          collateral: fromWei(status[0]) - fromWei(status[1]),
          health: fromWei(status[3]),
          solvent: fromWei(status[4]) === 1e-18
        };
    
        await db.collection('loansArbitrum').doc(address).set(loan);
      } catch(error) {
        console.log(error);
      }
    })
  );

  return event;
}