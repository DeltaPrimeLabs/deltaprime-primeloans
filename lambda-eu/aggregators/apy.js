
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

    for (const [identifier, poolInfo] of Object.entries(pools)) {
      try {
        const pool = poolRows[poolInfo.index];
        const tvlColumn = await pool.$("div > div.relative > div.items-center > div.justify-center > div.relative > span");
        const tvlRaw = (await (await tvlColumn.getProperty("textContent")).jsonValue()).replace(/\s+/g, "").replace('$', '').trim();
        const tvlUnit = tvlRaw.charAt(tvlRaw.length - 1) === "K" ? 1000 : 1000000;
        const poolTvl = tvlUnit * parseFloat(tvlRaw.slice(0, -1));

        const apyColumn = await pool.$$("div > div.relative > div.items-center > div.justify-self-center > span > div > div.hidden > div.justify-between > span");
        let poolApy = 0;

        try {
          for (const rowIndex of poolInfo.apyIndexes) {
            const apyRaw = apyColumn[rowIndex];
            const rowApy = (await (await apyRaw.getProperty("textContent")).jsonValue()).replace(/\s+/g, "").replace('%', '').trim();
            poolApy += Number(rowApy);
          }
        } catch (error) {
          console.log(error);
        }

        console.log(identifier, poolTvl, poolApy);

        const params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: identifier
          },
          AttributeUpdates: {
            lp_tvl: {
              Value: Number(poolTvl) ? poolTvl : 0,
              Action: "PUT"
            },
            lp_apy: {
              Value: Number(poolApy) ? poolApy / 100 : 0,
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
