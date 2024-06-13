
const { newChrome } = require("../utils/chrome");
const { dynamoDb } = require("../utils/helpers");
const wombatApyConfig = require("../config/wombatApy.json");

const wombatApyAggregator = async (event) => {
  const { page } = await newChrome();

  // navigate pools page and wait till javascript fully load.
  const BASE_URL = "https://app.wombat.exchange/pool";

  await page.setViewport({
    width: 1920,
    height: 1080
  });

  // fetch GM tokens' APYs on Arbitrum and Avalanche
  for (const [network, pools] of Object.entries(wombatApyConfig)) {
    const PAGE_URL = `${BASE_URL}?chain=${network}`;
    await page.goto(PAGE_URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    await new Promise((resolve, reject) => setTimeout(resolve, 10000));

    const poolRows = await page.$$("#pool-list > div.flex-col > div.flex-col > div.flex-col > div");
    await page.screenshot({ path: 'fullpage.png', fullPage: true });

    for (const [identifier, index] of Object.entries(pools)) {
      try {
        const pool = poolRows[index];
        const tvlColumn = await pool.$("div > div.relative > div.items-center > div.justify-center > div.relative > span");
        const tvlRaw = (await (await tvlColumn.getProperty("textContent")).jsonValue()).replace(/\s+/g, "").replace('$', '').trim();
        const tvlUnit = tvlRaw.charAt(tvlRaw.length - 1) === "K" ? 1000 : 1000000;
        const poolTvl = tvlUnit * parseFloat(tvlRaw.slice(0, -1));

        // const poolApy = poolInnerTexts[index].split('Avg.APR')[1].split('AverageTotalAPR')[0].replace('%', '').trim();
        const apyColumn = await pool.$("div > div.relative > div.items-center > div.justify-self-center > p > span");
        const poolApy = (await (await apyColumn.getProperty("textContent")).jsonValue()).replace(/\s+/g, "").replace('%', '').trim();

        console.log(identifier, poolTvl, poolApy);

        const params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: identifier
          },
          AttributeUpdates: {
            lp_tvl: {
              Value: Number(poolTvl) ? poolTvl : null,
              Action: "PUT"
            },
            lp_apy: {
              Value: Number(poolApy) ? poolApy / 100 : null,
              Action: "PUT"
            }
          }
        };
        await dynamoDb.update(params).promise();
      } catch (error) {
        console.log(error);
      }
    }
  }

  console.log('fetching done.');

  return event;
}

module.exports = {
  wombatApyAggregator
}
