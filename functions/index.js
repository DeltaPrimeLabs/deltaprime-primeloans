//FIRESTORE config
const functions = require("firebase-functions");
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");
const vectorApyConfig = require('./vectorApy.json');
const yieldYakConfig = require('./yieldYakApy.json');
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
  .runWith({ timeoutSeconds: 300, memory: "1GB" })
  .pubsub.schedule('* * * * *')
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
  await db.collection('apys').doc('GLP').set({
    apy: glpApy
  }, { merge: true });

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

const getUsdtAutoApr = async () => {
  functions.logger.info("parsing APR from Vector Finance website");
  // parsing USDT Auto APY from Vector Finance pools page
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

  const usdtApy = await page.evaluate(() => {
    // select the pools with relevant class and find USDT record
    const pools = document.querySelectorAll("div.MuiAccordionSummary-content");
    const usdtPool = Array.from(pools).find(pool => pool.innerText.replace(/\s+/g, "").toLowerCase().startsWith("usdtauto"));
    const columns = usdtPool.querySelectorAll("p.MuiTypography-root.MuiTypography-body1");

    // parse APR of GLP on Avalanche
    return parseFloat(columns[2].innerText.split('%')[0].trim());
  });

  console.log(usdtApy / 100);
  await db.collection('apys').doc('USDT').set({
    VF_USDT_MAIN_AUTO: usdtApy / 100 // USDT pool protocolIdentifier from config
  }, { merge: true });

  await browser.close();
}

exports.vectorScraper = functions
  .runWith({ timeoutSeconds: 300, memory: "2GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    return getUsdtAutoApr()
      .then(() => {
        functions.logger.info("USDT APY updated.");
      }).catch((err) => {
        functions.logger.info(`Scraping USDT APY from VectorFinance failed. Error: ${err}`);
      });
  });

exports.apyAggregator = functions
  .runWith({ timeoutSeconds: 120, memory: "1GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting APRs.");

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

        functions.logger.info(`Fetching APYs finished.`);
      });

    } catch (error) {
      functions.logger.info(`Fetching APYs failed. Error: ${error}`);
    }

    return null;
  });
