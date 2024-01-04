//FIRESTORE config
const functions = require("firebase-functions");
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const cors = require('cors')({origin: true});


const serviceAccount = require('./delta-prime-db-firebase-adminsdk-nm0hk-12b5817179.json');

initializeApp({
  credential: cert(serviceAccount)
});

const factoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
const factoryArbitrumAddress = "0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20";

const fs = require("fs");

const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const jsonRPC = config.jsonRpc;
const jsonRPCArbitrum = config.jsonRpcArbitrum;

const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const FACTORY = require(`./SmartLoansFactory.json`);
const LOAN = require(`./SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const CACHE_LAYER_URLS = require('./redstone-cache-layer-urls.json');

const db = getFirestore();

const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const wallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(provider);

let factory = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

const providerArbitrum = new ethers.providers.JsonRpcProvider(jsonRPCArbitrum);
const walletArbitrum = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(providerArbitrum);

let factoryArbitrum = new ethers.Contract(factoryArbitrumAddress, FACTORY.abi, providerArbitrum);

const fromWei = val => parseFloat(ethers.utils.formatEther(val));
const formatUnits = (val, decimals) => parseFloat(ethers.utils.formatUnits(val, decimals));

function wrap(contract, network) {
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
    const loanContract = new ethers.Contract(address, LOAN.abi, network == "avalanche" ? wallet : walletArbitrum);
    const wrappedContract = wrap(loanContract, network);

    return wrappedContract;
  });
}

const uploadLiveLoansStatusAvalanche = async () => {
  const loanAddresses = await factory.getAllLoans();
  const totalLoans = loanAddresses.length;
  const batchSize = 35;

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

exports.saveLiveLoansStatusAvalanche = functions
  .runWith({ timeoutSeconds: 500, memory: "2GB" })
  .pubsub.schedule('0 5 * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting Loans Status.");
    return uploadLiveLoansStatusAvalanche()
      .then(() => {
        functions.logger.info("Live Loans Status Avalanche upload success.");
      }).catch((err) => {
        functions.logger.info(`Live Loans Status Avalanche upload failed. Error: ${err}`);
      });
  });

const uploadLiveLoansStatusArbitrum = async () => {
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

exports.saveLiveLoansStatusArbitrum = functions
  .runWith({ timeoutSeconds: 120, memory: "2GB" })
  .pubsub.schedule('0 5 * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting Loans Status.");
    return uploadLiveLoansStatusArbitrum()
      .then(() => {
        functions.logger.info("Live Loans Status Arbitrum upload success.");
      }).catch((err) => {
        functions.logger.info(`Live Loans Status Arbitrum upload failed. Error: ${err}`);
      });
  });

exports.loanhistory = functions
  .runWith({ timeoutSeconds: 120, memory: "1GB" })
  .https
  .onRequest((req, res) => {
    cors(req, res, async () => {
      const address = req.query.address
      const from = req.query.from;
      const to = req.query.to;
      const network = req.query.network;
      console.log(address, from, to)

      if (!address) {
        res.status(400).send({
          error: true,
          data: [],
          message: "valid loan address is required"
        })
      }

      let historyCol;
      if (network === 'avalanche') {
        historyCol = 'loansHistory';
      } else if (network === 'arbitrum') {
        historyCol = 'loansHistoryArbitrum';
      } else {
        res.status(400).send({
          success: false,
          message: 'wrong network',
        })
      }

      const loanHistoryRef = db
        .collection(historyCol)
        .doc(address.toLowerCase())
        .collection('loanStatus');
      let snapshot;

      if (!from || !to) {
        snapshot = await loanHistoryRef.get();
      } else {
        snapshot = await loanHistoryRef
          .where('timestamp', '>=', Number(from))
          .where('timestamp', '<=', Number(to))
          .get();
      }

      if (snapshot.empty) {
        res.status(200).send({
          sucess: true,
          data: [],
          message: "there is no loan history for the period"
        })
      } else {
        const loanHistory = {};

        snapshot.forEach(doc => {
          loanHistory[doc.id] = doc.data();
        });

        const timestamps = Object.keys(loanHistory).map(Number).sort((a, b) => a - b);
        const data = [];
        const events = [];
        console.log(loanHistory);

          timestamps.map((timestamp) => {
            data.push({
              timestamp: timestamp,
              totalValue: loanHistory[timestamp].totalValue,
              borrowed: loanHistory[timestamp].debtValue,
              collateral: loanHistory[timestamp].collateral,
              health: loanHistory[timestamp].health,
              solvent: loanHistory[timestamp].solvent,
              events
            });
          });

          res.status(200).send({
            success: true,
            data,
          })
        }      
    });
  }
)
