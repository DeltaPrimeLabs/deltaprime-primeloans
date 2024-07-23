const ethers = require('ethers');
const {
  dynamoDb,
  fromWei,
  fromBytes32,
  formatUnits,
  avalancheHistoricalProvider,
  arbitrumHistoricalProvider,
  getWrappedContractsHistorical,
  getArweavePackages
} = require('../utils/helpers');
const fs = require('fs');
const constants = require('../config/constants.json');
const gmTokens = require('../config/gmTokens.json');
const FACTORY = require('../abis/SmartLoansFactory.json');
const EthDater = require("ethereum-block-by-date");
const redstone = require("redstone-api");
const getAllLoansAbi = [
  {
    "inputs": [],
    "name": "getAllLoans",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
]
const SLFArbitrumAddress = '0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20';
const slfContract = new ethers.Contract(SLFArbitrumAddress, getAllLoansAbi, arbitrumHistoricalProvider);

// const config = require("../../src/config");
// const key = fs.readFileSync("./.secret").toString().trim();

// const Web3 = require('web3');
// const fs = require("fs");
const blockTimestampStart = 1719494583;
const blockTimestampEnd = 1719571663;

const factoryAddress = constants.avalanche.factory;

const getBlockForTimestamp = async (timestamp) => {
  const dater = new EthDater(
    avalancheHistoricalProvider // ethers provider, required.
  );

  return await dater.getDate(
    timestamp, // Date, required. Any valid moment.js value: string, milliseconds, Date() object, moment() object.
    true // Block after, optional. Search for the nearest block before or after the given date. By default true.
  );
}

const findClosest = (numbers, target) => {

  let closest = numbers[0];
  // Assume the first number is the closest
  let closestDiff = Math.abs(target - closest.timestamp);

  // Calculate the difference between the target and closest
  for (let i = 1; i < numbers.length; i++) {
    let current = numbers[i];
    let currentDiff = Math.abs(target - current.timestamp);

    // Calculate the difference between the target and current number
    if (currentDiff < closestDiff) {
      closest = current;

      // Update the closest number
      closestDiff = currentDiff;

      // Update the closest difference
    }
  }
  return closest;
}

function writeJSON(filename, data) {
  fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf8');
}

function readJSON(filename) {
  const data = fs.readFileSync(filename, 'utf8');
  return JSON.parse(data);
}

const gmxIncentivesCalculatorAvaRetroactive = async (event) => {
  //in seconds
  let timestampInSeconds = blockTimestampStart;

  // let prices = {};

  // for (let gmSymbol of Object.keys(gmTokens.avalanche)) {
  //   const resp = await redstone.getHistoricalPrice(gmSymbol, {
  //     startDate: (blockTimestampStart - 60 * 60 * 4) * 1000,
  //     interval: 60 * 60 * 1000,
  //     endDate: (blockTimestampEnd + 60 * 60 * 4) * 1000,
  //     provider: "redstone"
  //   });

  //   prices[gmSymbol] = resp;
  // }

  // console.log('Prices:');
  // console.log(prices);

  // const blockNumbers = [
  //   235008014
  // ]

  let checkedPasFileName = 'checkedPAs.json';
  let checkedPas = readJSON(checkedPasFileName);
  let alreadyCheckedPas = checkedPas.map(entry => entry.address);


  const pasToMonitor = [
      "0x22356d363283e71943D3Fe6C70A2812f8AC12F64",
      "0xABCBE607f39D73D29CF46dcb9529609466Fa504b",
      "0x0547c4580CE540F8D069182C56D55A9BA4199bcC",
  ]

  let allPas = await slfContract.getAllLoans();
    console.log(allPas.length);

  let insolventPAs = []
  const dollarValueThreshold = 10;
  // let blockBeforeOwnershipTransfer = 234910548;
  let blockBeforePausingProtocol = 235008030;
  const block = await arbitrumHistoricalProvider.getBlock(blockBeforePausingProtocol);
  const timestamp = block.timestamp;
  let packages = await getArweavePackages(timestamp, 'arbitrum');
  console.log('Got packages')
  let counter = 0;
  for (const pa of allPas) {
    counter++;
    if(alreadyCheckedPas.includes(pa)) {
        console.log(`Already checked PA: ${pa}`)
        continue;
    }
    console.log(`Checking for PA: ${pa} (${counter}/${allPas.length})`)

    const [wrappedContract] = await getWrappedContractsHistorical([pa], 'arbitrum', packages);

    async function runMethod(contract, methodName, blockNumber) {
      const tx = await contract.populateTransaction[methodName]()
      let res = await contract.signer.call(tx, blockNumber)
      return contract.interface.decodeFunctionResult(
        methodName,
        res
      );
    }

    // const totalValueBefore = fromWei((await runMethod(wrappedContract, 'getTotalValue', blockBeforeOwnershipTransfer)).toString());
    // console.log('1')
    // const debtBefore = fromWei((await runMethod(wrappedContract, 'getDebt', blockBeforeOwnershipTransfer)).toString());
    // console.log('2')
    // const colateralBefore = totalValueBefore - debtBefore;

    const totalValueAfter = fromWei((await runMethod(wrappedContract, 'getTotalValue', blockBeforePausingProtocol)).toString());
    // if(totalValueAfter < dollarValueThreshold) {
    //     console.log(`PA: ${pa} has less than $${dollarValueThreshold} value!`);
    //     checkedPas.push({address: pa, totalValue: totalValueAfter});
    //     writeJSON(checkedPasFileName, checkedPas);
    //     continue;
    // }
    // const debtAfter = fromWei((await runMethod(wrappedContract, 'getDebt', blockBeforePausingProtocol)).toString());
    const HRAfter = fromWei((await runMethod(wrappedContract, 'getHealthRatio', blockBeforePausingProtocol)).toString());
    checkedPas.push({address: pa, totalValue: totalValueAfter, hr: HRAfter});
    writeJSON(checkedPasFileName, checkedPas);
    // const collateralAfter = totalValueAfter - debtAfter;
    console.log(`totalValueAfter: ${totalValueAfter}`)
    console.log(`HRAfter: ${HRAfter}`)
    if(HRAfter <= 1.0) {
      insolventPAs.push(pa);
      console.log(`PA: ${pa} is INSOLVENT!`)
    }

  }
  console.log(`Insolvent PAs: ${insolventPAs.length}`)
    console.log(JSON.stringify(insolventPAs, null, 4))

  // return event;
}

module.exports.handler = gmxIncentivesCalculatorAvaRetroactive;

gmxIncentivesCalculatorAvaRetroactive();