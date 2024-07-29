const ethers = require('ethers');
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
  arbitrumHistoricalProvider,
  getWrappedContractsHistorical,
  getArweavePackages
} = require('../utils/helpers');
const constants = require('../config/constants.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");

const getBlockForTimestamp = async (timestamp) => {
  const dater = new EthDater(
    arbitrumHistoricalProvider // ethers provider, required.
  );

  return await dater.getDate(
    timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  );
}

const ltipLoanLeaderboard = async() => {
  const loanAddresses = [
    "0x2FfD0D2bEa8E922A722De83c451Ad93e097851F5",
    "0x0b7DcF8E70cF0f9c73D2777d871F4eBD6150Bd3b",
    "0x48285109D4b959608C8E9691cAb1aFc244a80D5F",
    "0xCC5159C01C1bdAb6c607F800E71B84898597c9FE",
    "0xfeD94826098d636c517F7F1021B37EB465b9FCE4",
    "0x58c80413603841455b3C5abF08d6AA854F376086",
    "0xc00bE32F7669A3417AD26DD41352418Fc49eB0F7",
    "0x36a1bCcf37AF1E315888c2cA967B163c50B1D943",
    "0xb9967f0e4ea928550E3d05B0e57a627AB0302108",
    "0x7F23dc430AF70aBE865387d5b1FDC91c27daEcCB",
    "0x35C93a488906798341ce4267Ecb398dC2aD230a6",
    "0x0844F379be6E5b7Fd4A6D8f7A1b5146A68E23e9f",
    "0xeAA7425910Af14657ED96a278274e6e85D947f2D"
  ];
  const incentivesPerWeek = 80000;
  const timestampInSeconds = 1721685007; // 1721685007, 1721674660

  let packages = await getArweavePackages(timestampInSeconds, 'arbitrum');
  let blockNumber = (await getBlockForTimestamp(timestampInSeconds * 1000)).block;
  // const factoryContract = new ethers.Contract(factoryAddress, FACTORY.abi, arbitrumHistoricalProvider);
  // let loanAddresses = await factoryContract.getAllLoans({ blockTag: blockNumber });
  const totalLoans = loanAddresses.length;
  const incentivesPerInterval = incentivesPerWeek / (60 * 60 * 24 * 7) * (60 * 60);

  const batchSize = 150;
  const loanQualifications = {};

  for (let i = 0; i < Math.ceil(totalLoans / batchSize); i++) {
    console.log(`processing ${i * batchSize} - ${(i + 1) * batchSize > totalLoans ? totalLoans : (i + 1) * batchSize} loans. ${timestampInSeconds}`);

    const batchLoanAddresses = loanAddresses.slice(i * batchSize, (i + 1) * batchSize);

    const wrappedContracts = await getWrappedContractsHistorical(batchLoanAddresses, 'arbitrum', packages)

    async function runMethod(contract, methodName, blockNumber) {
      const tx = await contract.populateTransaction[methodName]()
      let res = await contract.signer.call(tx, blockNumber)
      return contract.interface.decodeFunctionResult(
        methodName,
        res
      )[0];
    }

    const loanStats = await Promise.all(
      wrappedContracts.map(contract => runMethod(contract, 'getLTIPEligibleTVL', blockNumber))
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
        })
      );
    }
  }

  console.log(loanQualifications);
}

ltipLoanLeaderboard();