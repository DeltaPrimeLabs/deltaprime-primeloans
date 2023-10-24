//FIRESTORE config
const functions = require("firebase-functions");
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
const ApolloClient = require("apollo-client").ApolloClient;
const createHttpLink = require("apollo-link-http").createHttpLink;
const InMemoryCache = require("apollo-cache-inmemory").InMemoryCache;
const gql = require("graphql-tag");
const cors = require('cors')({origin: true});

const vectorApyConfig = require('./vectorApy.json');
const yieldYakConfig = require('./yieldYakApy.json');
const tokenAddresses = require('./token_addresses.json');
const lpAssets = require('./lpAssets.json');
const steakHutApyConfig = require('./steakHutApy.json');
const traderJoeConfig = require('./traderJoeApy.json');
const sushiConfig = require('./sushiApy.json');
const beefyConfig = require('./beefyApy.json');
const levelConfig = require('./levelApy.json');

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
const VECTOR_APY_URL = "https://vector-api-git-overhaul-vectorfinance.vercel.app/api/v1/vtx/apr";
const YIELDYAK_APY_AVA_URL = "https://staging-api.yieldyak.com/apys";
const YIELDYAK_APY_ARB_URL = "https://staging-api.yieldyak.com/42161/apys";

const { getLoanStatusAtTimestamp } = require('./loan-history');
const timestampInterval = 24 * 3600 * 1000;

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

// exports.scheduledFunctionAvalanche = functions
//   .runWith({ timeoutSeconds: 300, memory: "2GB" })
//   .pubsub.schedule('*/1 * * * *')
//   .onRun(async (context) => {
//     functions.logger.info("Getting loans");

//     const loanAddresses = await factory.getAllLoans();
//     const batchTime = new Date().getTime();

//     await Promise.all(
//       loanAddresses.map(async (address) => {
//         try {
//           const loanContract = new ethers.Contract(address, LOAN.abi, wallet);
//           const wrappedContract = wrap(loanContract, 'avalanche');
//           const status = await wrappedContract.getFullLoanStatus();

//           const loan = {
//             time: batchTime,
//             address: address,
//             total: fromWei(status[0]),
//             debt: fromWei(status[1]),
//             collateral: fromWei(status[0]) - fromWei(status[1]),
//             health: fromWei(status[3]),
//             solvent: fromWei(status[4]) === 1e-18
//           };

//           await db.collection('loans').doc(address).set(loan);
//         } catch(error) {
//           console.log(error);
//         }
//       }),
//     );

//     functions.logger.info(`Uploaded ${loanAddresses.length} loans.`);

//     return null;
//   });

// exports.scheduledFunctionArbitrum = functions
//   .runWith({ timeoutSeconds: 300, memory: "2GB" })
//   .pubsub.schedule('*/1 * * * *')
//   .onRun(async (context) => {
//     functions.logger.info("Getting loans");

//     const loanAddressesArbitrum = await factoryArbitrum.getAllLoans();
//     const batchTime = new Date().getTime();

//     await Promise.all(
//       loanAddressesArbitrum.map(async (address) => {
//         try {
//           const loanContract = new ethers.Contract(address, LOAN.abi, walletArbitrum);
//           const wrappedContract = wrap(loanContract, 'arbitrum');
//           const status = await wrappedContract.getFullLoanStatus();

//           const loan = {
//             time: batchTime,
//             address: address,
//             total: fromWei(status[0]),
//             debt: fromWei(status[1]),
//             collateral: fromWei(status[0]) - fromWei(status[1]),
//             health: fromWei(status[3]),
//             solvent: fromWei(status[4]) === 1e-18
//           };
      
//           await db.collection('loansArbitrum').doc(address).set(loan);
//         } catch(error) {
//           console.log(error);
//         }
//       })
//     );

//     functions.logger.info(`Uploaded ${loanAddressesArbitrum.length} loans.`);

//     return null;
//   });

const getGlpApr = async () => {
  functions.logger.info("parsing APR from GMX website");
  // parse GLP APR from GMX website
  const URL = "https://gmx.io/";
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // navigate gmx website and wait till fully load
  await page.goto(URL);
  const glpApySelector = "div.Home-token-card-option-apr";
  await page.mainFrame().waitForFunction(
    selector => !!document.querySelector(selector).innerText,
    {},
    glpApySelector
  )

  const glpApy = await page.evaluate(() => {
    // select the elements with relevant class
    const items = document.querySelectorAll(".Home-token-card-option-apr");

    // parse APR of GLP on Avalanche
    return parseFloat(items[1].innerText.split(':').at(-1).trim().replaceAll('%', ''));
  });

  console.log(glpApy);
  if (glpApy && Number(glpApy) != 0) {
    await db.collection('apys').doc('GLP').set({
      apy: glpApy
    }, { merge: true });
  }

  await browser.close();
};

exports.gmxScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getGlpApr()
      .then(() => {
        functions.logger.info("GLP APY updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping GLP APY failed. Error: ${err}`);
      });
  });

const getApysFromVector = async () => {
  functions.logger.info("parsing APYs from Vector Finance website");
  const URL = "https://vectorfinance.io/pools";
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // navigate pools page and wait till javascript fully load.
  await page.goto(URL, {
    waitUntil: "networkidle0",
    timeout: 60000
  });

  functions.logger.info("parsing auto compounding APYs...");
  const [avaxApy, savaxApy, usdcApy, usdtApy] = await page.evaluate(() => {
    const parseApyFromTable = (pools, keyword) => {
      const assetPool = Array.from(pools).find(pool => pool.innerText.replace(/\s+/g, "").toLowerCase().startsWith(keyword));
      const assetColumns = assetPool.querySelectorAll("p.MuiTypography-root.MuiTypography-body1");
      const assetApy = parseFloat(assetColumns[2].innerText.split('%')[0].trim());
    
      return assetApy;
    }

    // select the pools with the class and find relevant records
    const pools = document.querySelectorAll("div.MuiAccordionSummary-content");

    // parsing USDT main auto APY
    const avaxApy = parseApyFromTable(pools, "avaxautopairedwithsavax");

    // parsing USDT main auto APY
    const savaxApy = parseApyFromTable(pools, "savaxautopairedwithavax");

    // parsing USDC main auto APY
    const usdcApy = parseApyFromTable(pools, "usdcautomainpool");

    // parsing USDT main auto APY
    const usdtApy = parseApyFromTable(pools, "usdtautomainpool");

    return [avaxApy, savaxApy, usdcApy, usdtApy];
  });

  console.log(avaxApy, savaxApy, usdcApy, usdtApy);

  // update APYs in db
  if (avaxApy && Number(avaxApy) != 0) {
    await db.collection('apys').doc('AVAX').set({
      VF_AVAX_SAVAX_AUTO: avaxApy / 100 // avax pool protocolIdentifier from config
    }, { merge: true });
  }

  if (savaxApy && Number(savaxApy) != 0) {
    await db.collection('apys').doc('sAVAX').set({
      VF_SAVAX_MAIN_AUTO: savaxApy / 100 // avax pool protocolIdentifier from config
    }, { merge: true });
  }

  if (usdcApy && Number(usdcApy) != 0) {
    await db.collection('apys').doc('USDC').set({
      VF_USDC_MAIN_AUTO: usdcApy / 100 // USDC pool protocolIdentifier from config
    }, { merge: true });
  }

  if (usdtApy && Number(usdtApy) != 0) {
    await db.collection('apys').doc('USDT').set({
      VF_USDT_MAIN_AUTO: usdtApy / 100 // USDT pool protocolIdentifier from config
    }, { merge: true });
  }

  // close browser
  await browser.close();
}

exports.vectorScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getApysFromVector()
      .then(() => {
        functions.logger.info("APYs scrapped and updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping APYs from VectorFinance failed. Error: ${err}`);
      });
  });

const getPangolinLpApr = async (url) => {
  let apr;

  if (url) {
    const resp = await fetch(url);
    const json = await resp.json();

    apr = json.swapFeeApr;
  } else {
    apr = 0;
  }

  return apr;
}

const getTraderJoeLpApr = async (lpAddress, assetAppreciation = 0) => {
  let tjSubgraphUrl = 'https://api.thegraph.com/subgraphs/name/traderjoe-xyz/exchange';

  const FEE_RATE = 0.0025;

  lpAddress = lpAddress.toLowerCase();

  let aprDate = new Date();

  const date = Math.round(aprDate.getTime() / 1000 - 32 * 3600);

  const pairQuery = gql(`
{
  pairs(
    first: 1
    where: {id: "${lpAddress}"}
  ) {
    id
    name
    token0Price
    token1Price
    token0 {
      id
      symbol
      decimals
    }
    token1 {
      id
      symbol
      decimals
    }
    reserve0
    reserve1
    reserveUSD
    volumeUSD
    hourData(
        first: 25
        where: {date_gte: ${date}}
        orderBy: date
        orderDirection: desc
      ) {
        untrackedVolumeUSD
        volumeUSD
        date
        volumeToken0
        volumeToken1
      }
    timestamp
    }
  }
`)

  const httpLink = createHttpLink({
    uri: tjSubgraphUrl,
    fetch: fetch
  });

  const client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache()
  });

  const response = await client.query({ query: pairQuery });

  const hourData = response.data.pairs[0].hourData;
  hourData.shift();

  let volumeUSD = parseFloat(hourData.reduce((sum, data) => sum + parseFloat(data.volumeUSD), 0));
  let reserveUSD = parseFloat(response.data.pairs[0].reserveUSD);



  const feesUSD = volumeUSD * FEE_RATE;

  return ((1 + feesUSD * 365 / reserveUSD) * (1 + assetAppreciation / 100) - 1) * 100;
}

exports.lpAndFarmApyAggregator = functions
  .runWith({ timeoutSeconds: 120, memory: "1GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting lp and farm APR/APYs.");

    // fetching lp APYs
    try {
      for (const [asset, data] of Object.entries(lpAssets)) {
        let apy;
        if (data.dex === "Pangolin") {
          apy = await getPangolinLpApr(data.url);
        } else if (data.dex === "TraderJoe") {
          apy = await getTraderJoeLpApr(tokenAddresses[asset], data.appreciation);
        }

        console.log(asset, apy);

        if (apy && Number(apy) != 0) {
          await db.collection('apys').doc(asset).set({
            lp_apy: apy
          }, { merge: true });
        }
      }

      functions.logger.info(`Fetching lp APYs finished.`);
    } catch (error) {
      functions.logger.info(`Fetching lp APYs failed. Error: ${error}`);
    };

    // fetching farm APYs
    const apys = {};
    const urls = [
      VECTOR_APY_URL,
      YIELDYAK_APY_AVA_URL,
      YIELDYAK_APY_ARB_URL
    ];

    try {
      Promise.all(urls.map(url =>
        fetch(url).then(resp => resp.json())
      )).then(async ([vectorAprs, yieldYakAvaApys, yieldYakArbApys]) => {

        if (!vectorAprs["Staking"]) functions.logger.info('APRs not available from Vector.');
        const stakingAprs = vectorAprs['Staking'];

        // fetching Vector APYs
        for (const [token, farm] of Object.entries(vectorApyConfig)) {
          if (Object.keys(stakingAprs).includes(farm.vectorId)) {
            // manual weekly APY
            const aprTotal = parseFloat(stakingAprs[farm.vectorId].total);
            const weeklyApy = (1 + aprTotal / 100 / 52) ** 52 - 1;

            if (token in apys) {
              apys[token][farm.protocolIdentifier] = weeklyApy;
            } else {
              apys[token] = {
                [farm.protocolIdentifier]: weeklyApy
              };
            }
          }
        }

        // fetching YieldYak APYs Avalanche
        for (const [token, farm] of Object.entries(yieldYakConfig.avalanche)) {
          if (!yieldYakAvaApys[farm.stakingContractAddress]) continue

          const yieldApy = yieldYakAvaApys[farm.stakingContractAddress].apy / 100;

          if (token in apys) {
            apys[token][farm.protocolIdentifier] = yieldApy;
          } else {
            apys[token] = {
              [farm.protocolIdentifier]: yieldApy
            };
          }
        }

        // fetching YieldYak APYs Arbitrum
        for (const [token, farm] of Object.entries(yieldYakConfig.arbitrum)) {
          if (!yieldYakArbApys[farm.stakingContractAddress]) continue

          const yieldApy = yieldYakArbApys[farm.stakingContractAddress].apy / 100;

          if (token in apys) {
            apys[token][farm.protocolIdentifier] = yieldApy;
          } else {
            apys[token] = {
              [farm.protocolIdentifier]: yieldApy
            };
          }
        }

        console.log(apys);
        // write apys to db
        for (const [token, apyData] of Object.entries(apys)) {
          await db.collection('apys').doc(token).set(apyData, { merge: true });
        }

        functions.logger.info(`Fetching farm APYs finished.`);
      });

    } catch (error) {
      functions.logger.info(`Fetching farm APYs failed. Error: ${error}`);
    }

    return null;
  });

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

// exports.saveLoansStatusFromFile = functions
//     .runWith({ timeoutSeconds: 120, memory: "2GB" })
//     .pubsub.schedule('*/5 * * * *')
//     .onRun(async (context) => {
//       functions.logger.info("Getting Loans Status.");
//       return uploadLoanStatusFromFile()
//           .then(() => {
//             functions.logger.info("Loans Status upload success.");
//           }).catch((err) => {
//             functions.logger.info(`Loans Status upload failed. Error: ${err}`);
//           });
//     });


// const getEventsForPeriod = (from, to) => {
// }

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

const uploadLoanStatusFromFile = async () => {
  // const loanAddresses = await factory.getAllLoans();

  const files = fs.readdirSync('results');
  const loanAddresses = files.map(filename => filename.replace('.json', ''));

  console.log(loanAddresses)

  for (const loanAddress of loanAddresses) {
    const loanHistoryRef = db
        .collection('loansHistory')
        .doc(loanAddress.toLowerCase())
        .collection('loanStatus');
    const loanHistorySnap = await loanHistoryRef.get();
    const loanHistory = [];

    loanHistorySnap.forEach(doc => {
      loanHistory.push({
        [doc.id]: doc.data()
      });
    });

    const file = fs.readFileSync(`results/${loanAddress}.json`, "utf-8");
    const json = JSON.parse(file);

    const dataPoints = json.dataPoints;

    console.log(dataPoints)

    for (const dataPoint of dataPoints) {
      try {
        await loanHistoryRef.doc(dataPoint.timestamp.toString()).set({
          totalValue: dataPoint.totalValue,
          borrowed: dataPoint.borrowed,
          collateral: dataPoint.totalValue - dataPoint.borrowed,
          twv: dataPoint.twv,
          health: dataPoint.health,
          solvent: dataPoint.solvent === 1e-18,
          timestamp: dataPoint.timestamp
        });
      } catch(e) {
        console.log('ERRRORRRR')
        console.log(e)
      }
    }
  }
}

const getApysFromSteakHut = async () => {
  functions.logger.info("parsing APYs from SteakHut");
  const URL = "https://app.steakhut.finance/pool/";
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  for (const [asset, address] of Object.entries(steakHutApyConfig)) {

    // navigate pools page and wait till javascript fully load.
    await page.goto(URL + address, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    functions.logger.info("parsing APR (7-Day)...");

    const apy = await page.evaluate(() => {
      const fields = document.querySelectorAll(".chakra-heading");
      return fields[0].innerText.replace("%", "").trim();
    });

    console.log(apy)

    // update APY in db
    if (apy && Number(apy) != 0) {
      await db.collection('apys').doc(asset).set({
        apy: apy / 100
      });
    }
  }

  // close browser
  await browser.close();
}

exports.steakhutScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getApysFromSteakHut()
      .then(() => {
        functions.logger.info("SteakHut APYs scrapped and updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping APYs from SteakHut failed. Error: ${err}`);
      });
  });

const getApysFromTraderJoe = async () => {
  functions.logger.info("parsing APYs from TraderJoe");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // fetch APYs for Avalanche and Arbitrum
  for (const [network, pools] of Object.entries(traderJoeConfig)) {
    for (const [pool, poolData] of Object.entries(pools)) {
      // navigate pools page and wait till javascript fully load.
      const URL = `https://traderjoexyz.com/${network}/pool/v21/`;
      await page.goto(URL + `${poolData.assetX}/${poolData.assetY}/${poolData.binStep}`, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      await page.evaluate(() => {
        const tabs = document.querySelectorAll(".chakra-tabs__tab");
        tabs[4].click();
        return tabs[4].innerText;
      })
      await new Promise((resolve, reject) => setTimeout(resolve, 3000));

      const stats = await page.$$(".chakra-stat__number");
      const apy = (await (await stats[3].getProperty('textContent')).jsonValue()).replace('%', '');
      console.log(apy);

      if (apy && Number(apy) != 0) {
        await db.collection('apys').doc(pool).set({
          lp_apy: apy / 100
        });
      }
    }
  }

  // close browser
  await browser.close();
}

exports.traderJoeScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getApysFromTraderJoe()
      .then(() => {
        functions.logger.info("TraderJoe APYs scrapped and updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping APYs from TraderJoe failed. Error: ${err}`);
      });
  });

const getApysFromSushi = async () => {
  functions.logger.info("parsing APYs from Sushi");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // fetch APYs for Avalanche and Arbitrum
  for (const [network, pools] of Object.entries(sushiConfig)) {
    for (const [pool, poolData] of Object.entries(pools)) {
      // navigate pools page and wait till javascript fully load.
      const URL = "https://www.sushi.com/pool";
      await page.goto(URL + `/${network}%3A${poolData.address}`, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      const stats = await page.$$(".decoration-dotted");
      const apy = (await (await stats[0].getProperty('textContent')).jsonValue()).replace('%', '');
      console.log(apy);

      if (apy && Number(apy) != 0) {
        await db.collection('apys').doc(pool).set({
          lp_apy: apy
        });
      }
    }
  }

  // close browser
  await browser.close();
}

exports.sushiScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getApysFromSushi()
      .then(() => {
        functions.logger.info("Sushi APYs scrapped and updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping APYs from Sushi failed. Error: ${err}`);
      });
  });

const getApysFromBeefy = async () => {
  functions.logger.info("parsing APYs from Beefy");
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // fetch APYs for Avalanche and Arbitrum
  for (const [protocol, networks] of Object.entries(beefyConfig)) {
    for (const [network, pools] of Object.entries(networks)) {
      for (const [pool, poolData] of Object.entries(pools)) {
        // navigate pools page and wait till javascript fully load.
        const URL = `https://app.beefy.com/vault/${protocol}-${network}-${pool}`;

        await page.goto(URL, {
          waitUntil: "networkidle0",
          timeout: 60000
        });

        const apy = await page.evaluate(() => {      
          const boxes = document.querySelectorAll("div.MuiBox-root");
          let apy;
          Array.from(boxes).map(box => {
            const content = box.innerText.replace(/\s+/g, "").toLowerCase();
            if (content.startsWith('apy')) {
              apy = content.replace('apy', '').replace('%', '').trim();
            }
          });

          return apy;
        });

        console.log(apy);

        if (apy && Number(apy) != 0) {
          await db.collection('apys').doc(poolData.symbol).set({
            [poolData.protocolIdentifier]: apy / 100
          });
        }
      }
    }
  }

  // close browser
  await browser.close();
}

exports.beefyScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getApysFromBeefy()
      .then(() => {
        functions.logger.info("Beefy APYs scrapped and updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping APYs from Beefy failed. Error: ${err}`);
      });
  });

const getApysFromLevel = async () => {
  functions.logger.info("parsing APYs from Level");
  const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";
  const redstoneFeedUrl = "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod";

  const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
  const redstonePriceData = await redstonePriceDataRequest.json();

  // fetch APYs from Level on Arbitrum
  const resp = await fetch(levelApiUrl);
  const liquidityPerformance = await resp.json();

  const arbLP = liquidityPerformance.find(item => item.chainId == 42161);
  for (const lpInfo of arbLP.lpInfos) {
    const liquidityInUsd = formatUnits(lpInfo.totalSupply, 18) * formatUnits(lpInfo.price, 12);

    let tradingFees = 0;

    for (const [address, fees] of Object.entries(lpInfo.feeDetailsPerWeek)) {
      Object.values(fees).forEach(fee => {
        tradingFees += formatUnits(fee, levelConfig.lpSymbols[address].decimals) * redstonePriceData[levelConfig.lpSymbols[address].symbol][0].dataPoints[0].value;
      });
    }

    const profit =
      (formatUnits(lpInfo.lvlRewards, 18) * formatUnits(lpInfo.lvlPrice, 12)) +
      formatUnits(lpInfo.mintingFee, 6) +
      formatUnits(lpInfo.pnlVsTrader, 30) +
      tradingFees;

    const apy = profit / liquidityInUsd / 7 * 365 * 100;
    console.log(apy);

    if (apy && Number(apy) != 0) {
      await db.collection('apys').doc(levelConfig[lpInfo.name].symbol).set({
        [levelConfig[lpInfo.name].protocolIdentifier]: apy
      });
    }
  }
}

exports.levelScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getApysFromLevel()
      .then(() => {
        functions.logger.info("Level APYs scrapped and updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping APYs from Level failed. Error: ${err}`);
      });
  });