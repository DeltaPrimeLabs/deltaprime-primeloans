//FIRESTORE config
const functions = require("firebase-functions");
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require("node-fetch");
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

// matching token ids of Vector Finance
const tokensForApy = {
  AVAX: 'AVAX',
  sAVAX: 'SAVAX',
  USDC: 'USDC',
  USDT: 'USDT',
  GLP: 'GLP',
};

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
  .runWith({ timeoutSeconds: 120, memory: "1GB" })
  .pubsub.schedule('* * * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting loans");

    const db = getFirestore();
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

exports.apyCollector = functions
  .runWith({ timeoutSeconds: 120, memory: "1GB" })
  .pubsub.schedule('*/1 * * * *')
  .onRun(async (context) => {
    functions.logger.info("Getting APRs");

    const db = getFirestore();
    const fetchTime = new Date().getTime();
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

        for (const [token, vfToken] of Object.entries(tokensForApy)) {
          if (Object.keys(stakingAprs).includes(vfToken)) {
            const weeklyApy = (1 + parseFloat(stakingAprs[vfToken].total) / 100 / 52) ** 52 - 1;
            console.log(weeklyApy);
            const apy = {
              manual: {
                apr: stakingAprs[vfToken].total,
                apy: weeklyApy
              },
              auto: {},
              fetchTime,
            };
            if (token in apys) {
              apys[token]['VECTOR_FINANCE'] = apy;
            } else {
              apys[token] = {
                VECTOR_FINANCE: apy
              }
            }
          }
        }

        for (const [token, farms] of Object.entries(yieldYakConfig)) {
          for (const farm of farms) {
            const yieldApy = yieldYakApys[farm.stakingContractAddress].apy / 100;
            const apy = {
              [farm.autoCompounding ? 'auto' : 'manual']: {
                apy: yieldApy
              }
            }
            if (token in apys) {
              apys[token]['YIELD_YAK'] = apy;
            } else {
              apys[token] = {
                YIELD_YAK: apy
              }
            }
          }
        }
    
        for (const [token, apyData] of Object.entries(apys)) {
          await db.collection('apys').doc(token).set(apyData);
        }
    
        functions.logger.info(`Fetching APYs from Vector finished.`);
      });

    } catch (error) {
      functions.logger.info(`Fetching APY from Vector failed. Error: ${error}`);
    }

    return null;
  });