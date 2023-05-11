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

const vectorApyConfig = require('./vectorApy.json');
const yieldYakConfig = require('./yieldYakApy.json');
const tokenAddresses = require('./token_addresses.json');
const lpAssets = require('./lpAssets.json');

const serviceAccount = require('./delta-prime-db-firebase-adminsdk-nm0hk-12b5817179.json');

initializeApp({
  credential: cert(serviceAccount)
});

const factoryAddress = "0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D";
//const jsonRPC = "https://api.avax.network/ext/bc/C/rpc";
const jsonRPC = "https://avalanche-mainnet.infura.io/v3/44a75435541f40cdac3945feaf38ba26"

const WrapperBuilder = require('@redstone-finance/evm-connector').WrapperBuilder;
const FACTORY = require(`./SmartLoansFactory.json`);
const LOAN = require(`./SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const CACHE_LAYER_URLS = require('./redstone-cache-layer-urls.json');
const VECTOR_APY_URL = "https://vector-api-git-overhaul-vectorfinance.vercel.app/api/v1/vtx/apr";
const YIELDYAK_APY_URL = "https://staging-api.yieldyak.com/apys";

const { getLoanStatusAtTimestamp } = require('./loan-history');
const timestampInterval = 24 * 3600 * 1000;

const db = getFirestore();

const provider = new ethers.providers.JsonRpcProvider(jsonRPC);
const wallet = (new ethers.Wallet("0xca63cb3223cb19b06fa42110c89ad21a17bad22ea061e5a2c2487bd37b71e809"))
  .connect(provider);

let factory = new ethers.Contract(factoryAddress, FACTORY.abi, provider);

const fromWei = val => parseFloat(ethers.utils.formatEther(val));

function wrap(contract) {
  return WrapperBuilder.wrap(contract).usingDataService(
    {
      dataServiceId: 'redstone-avalanche-prod',
      uniqueSignersCount: 3,
      disablePayloadsDryRun: true
    },
    CACHE_LAYER_URLS.urls
  );
}

exports.scheduledFunction = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting loans");

    const loanAddresses = await factory.getAllLoans();
    const batchTime = new Date().getTime();

    await Promise.all(
      loanAddresses.map(async (address) => {
        const loanContract = new ethers.Contract(address, LOAN.abi, wallet);
        const wrappedContract = wrap(loanContract);
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
      })
    )

    functions.logger.info(`Uploaded ${loanAddresses.length} loans.`);

    return null;
  });

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
  if (glpApy) {
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
  await page.goto(URL);
  const vtxPriceSelector = "div.price-and-gas div[title='VTX']";
  await page.mainFrame().waitForFunction(
    selector => !!document.querySelector(selector).innerText,
    {},
    vtxPriceSelector
  )

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
  if (avaxApy) {
    await db.collection('apys').doc('AVAX').set({
      VF_AVAX_SAVAX_AUTO: avaxApy / 100 // avax pool protocolIdentifier from config
    }, { merge: true });
  }

  if (savaxApy) {
    await db.collection('apys').doc('sAVAX').set({
      VF_SAVAX_MAIN_AUTO: savaxApy / 100 // avax pool protocolIdentifier from config
    }, { merge: true });
  }

  if (usdcApy) {
    await db.collection('apys').doc('USDC').set({
      VF_USDC_MAIN_AUTO: usdcApy / 100 // USDC pool protocolIdentifier from config
    }, { merge: true });
  }

  if (usdtApy) {
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

exports.apyAggregator = functions
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

        await db.collection('apys').doc(asset).set({
          lp_apy: apy
        }, { merge: true });
      }

      functions.logger.info(`Fetching lp APYs finished.`);
    } catch (error) {
      functions.logger.info(`Fetching lp APYs failed. Error: ${error}`);
    };

    // fetching farm APYs
    const apys = {};
    const urls = [
      VECTOR_APY_URL,
      YIELDYAK_APY_URL
    ]

    try {

      Promise.all(urls.map(url =>
        fetch(url).then(resp => resp.json())
      )).then(async ([vectorAprs, yieldYakApys]) => {

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

        // fetching YieldYak APYs
        for (const [token, farm] of Object.entries(yieldYakConfig)) {
          const yieldApy = yieldYakApys[farm.stakingContractAddress].apy / 100;

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

const uploadLoanStatus = async () => {
  const loanAddresses = await factory.getAllLoans();

  for (const loanAddress of loanAddresses) {
    const defaultTimestamp = Date.now() - 30 * timestampInterval; // from 30 days ago by default
    const loanHistoryRef = db
      .collection('loansHistory')
      .doc(loanAddress.toLowerCase())
      .collection('loanStatus');
    const loanHistorySnap = await loanHistoryRef.get();
    const loanHistory = {};

    loanHistorySnap.forEach(doc => {
      loanHistory[doc.id] = doc.data();
    });

    const timestamps = [];
    let timestamp;

    if (Object.keys(loanHistory).length === 0) {
      // loan's single history is not saved yet, we create from 30 days ago
      timestamp = defaultTimestamp;
    } else {
      // we add new history after the latest timestamp
      timestamp = Math.max(Math.min(...Object.keys(loanHistory).map(Number)), defaultTimestamp)
                + timestampInterval; // next timestamp where we get loan status
    }

    // const limitTimestamp = timestamp + 30 * timestampInterval;

    // get timestamps
    while (timestamp < Date.now()) {
      timestamps.push(timestamp);
      timestamp += timestampInterval;
    }
    console.log(timestamps);

    if (timestamps.length > 0) {
      return await Promise.all(
        timestamps.map(async (timestamp) => {
          const status = await loanHistoryRef.doc(timestamp.toString()).get();

          if (!status.exists) {
            const loanStatus = await getLoanStatusAtTimestamp(loanAddress, timestamp);

            await loanHistoryRef.doc(timestamp.toString()).set({
              totalValue: loanStatus.totalValue,
              borrowed: loanStatus.borrowed,
              collateral: loanStatus.totalValue - loanStatus.borrowed,
              twv: loanStatus.twv,
              health: loanStatus.health,
              solvent: loanStatus.solvent === 1e-18,
              timestamp: timestamp
            });
          }
        })
      );
    }
  }
}

exports.saveLoansStatusHourly = functions
  .runWith({ timeoutSeconds: 120, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting Loans Status.");
    return uploadLoanStatus()
      .then(() => {
        functions.logger.info("Loans Status upload success.");
      }).catch((err) => {
        functions.logger.info(`Loans Status upload failed. Error: ${err}`);
      });
  });

// const getEventsForPeriod = (from, to) => {
// }

exports.loanhistory = functions
  .https
  .onRequest(async (req, res) => {
    const address = req.query.address
    const from = req.query.from;
    const to = req.query.to;
    console.log(address, from, to)

    if (!address) {
      res.status(400).send({
        error: true,
        data: [],
        message: "valid loan address is required"
      })
    }

    const loanHistoryRef = db
      .collection('loansHistory')
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
  }
)
