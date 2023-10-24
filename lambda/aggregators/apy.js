const ethers = require("ethers");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer");

const {
  dynamoDb,
} = require("../utils/helpers");

const vectorApyConfig = require('../config/vectorApy.json');
const yieldYakConfig = require('../config/yieldYakApy.json');
const tokenAddresses = require('../config/token_addresses.json');
const lpAssets = require('../config/lpAssets.json');
const steakHutApyConfig = require('../config/steakHutApy.json');
const traderJoeConfig = require('../config/traderJoeApy.json');
const sushiConfig = require('../config/sushiApy.json');
const beefyConfig = require('../config/beefyApy.json');
const levelConfig = require('../config/levelApy.json');

const formatUnits = (val, decimals) => parseFloat(ethers.utils.formatUnits(val, decimals));

const levelTvlAggregator = async () => {
  console.log('fetching TVLs from Level..');
  const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";

  // fetch APYs from Level on Arbitrum
  const resp = await fetch(levelApiUrl);
  const liquidityPerformance = await resp.json();

  const arbLP = liquidityPerformance.find(item => item.chainId == 42161);
  for (const lpInfo of arbLP.lpInfos) {
    const liquidityInUsd = formatUnits(lpInfo.totalSupply, 18) * formatUnits(lpInfo.price, 12);
    console.log(liquidityInUsd);

    const tvl = {
      id: levelConfig[lpInfo.name].symbol,
      tvl: liquidityInUsd ? liquidityInUsd : null
    };

    const params = {
      TableName: process.env.APY_TABLE,
      Item: tvl
    };
    await dynamoDb.put(params).promise();
  }
}

const glpAprAggregator = async () => {
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

  const params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "GLP"
    },
    AttributeUpdates: {
      apy: {
        Value: glpApy ? glpApy : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  await browser.close();
}

const vectorApyAggregator = async () => {
  const URL = "https://vectorfinance.io/pools";
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();

  // navigate pools page and wait till javascript fully load.
  await page.goto(URL, {
    waitUntil: "networkidle0",
    timeout: 60000
  });
  // const vtxPriceSelector = "header.not-landing-page div[title='VTX']";
  // await page.mainFrame().waitForFunction(
  //   selector => !!document.querySelector(selector).innerText,
  //   {},
  //   vtxPriceSelector
  // )

  console.log("parsing auto compounding APYs...");
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
  let params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "AVAX"
    },
    AttributeUpdates: {
      VF_AVAX_SAVAX_AUTO: {
        Value: avaxApy ? avaxApy : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "AVAX"
    },
    AttributeUpdates: {
      VF_SAVAX_MAIN_AUTO: {
        Value: savaxApy ? savaxApy : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "AVAX"
    },
    AttributeUpdates: {
      VF_USDC_MAIN_AUTO: {
        Value: usdcApy ? usdcApy : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  params = {
    TableName: process.env.APY_TABLE,
    Key: {
      id: "AVAX"
    },
    AttributeUpdates: {
      VF_USDT_MAIN_AUTO: {
        Value: usdtApy ? usdtApy : null,
        Action: "PUT"
      }
    }
  };
  await dynamoDb.update(params).promise();

  // close browser
  await browser.close();
}

module.exports = {
  levelTvlAggregator,
  glpAprAggregator,
  vectorApyAggregator
}