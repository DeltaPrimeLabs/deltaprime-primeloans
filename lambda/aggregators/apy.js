const ethers = require("ethers");
const fetch = require("node-fetch");

const {newChrome} = require("../utils/chrome");
const {dynamoDb} = require("../utils/helpers");
const {fetchTraderJoeLpApr} = require("../utils/graphql");
const {fetchPangolinLpApr} = require("../utils/rest");

const vectorApyConfig = require("../config/vectorApy.json");
const yieldYakConfig = require("../config/yieldYakApy.json");
const tokenAddresses = require("../config/token_addresses.json");
const lpAssets = require("../config/lpAssets.json");
const steakHutApyConfig = require("../config/steakHutApy.json");
const traderJoeConfig = require("../config/traderJoeApy.json");
const sushiConfig = require("../config/sushiApy.json");
const beefyConfig = require("../config/beefyApy.json");
const levelConfig = require("../config/levelApy.json");
const gmxApyConfig = require("../config/gmxApy.json");
const balancerApyConfig = require("../config/balancerApy.json");
const {firstValueFrom} = require("rxjs/src");
const {EMPTY} = require("rxjs");

const formatUnits = (val, decimals) => parseFloat(ethers.utils.formatUnits(val, decimals));


const levelTvlAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }
  console.log('fetching TVLs from Level..');
  const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";

  // fetch APYs from Level on Arbitrum
  try {
    const resp = await fetch(levelApiUrl);
    const liquidityPerformance = await resp.json();

      if (!vectorAprs["Staking"]) console.log('APRs not available from Vector.');
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
        const attributes = {};

        for (const [identifier, apy] of Object.entries(apyData)) {
          attributes[identifier] = {
            Value: Number(apy) ?apy : null,
            Action: "PUT"
          }
        }

        params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: token
          },
          AttributeUpdates: attributes
        };
        await dynamoDb.update(params).promise();
      }

      console.log(`Fetching farm APYs finished.`);
    });

  } catch (error) {
    console.log(`Fetching farm APYs failed. Error: ${error}`);
  }

  return event;
}

const steakHutApyAggregator = async (event) => {
  const URL = "https://app.steakhut.finance/pool/";

  const { browser, page } = await newChrome();

  for (const [asset, address] of Object.entries(steakHutApyConfig)) {

    // navigate pools page and wait till javascript fully load.
    await page.goto(URL + address, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    console.log("parsing APR (7-Day)...");

    const apy = await page.evaluate(() => {
      const fields = document.querySelectorAll(".chakra-heading");
      return fields[1].innerText.replace("%", "").trim();
    });

    console.log(asset, apy)

    // update APY in db
    const params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: asset
      },
      AttributeUpdates: {
        apy: {
          Value: Number(apy) ? apy / 100 : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();
  }

  // await browser.close();

  console.log('fetching done.');

  return event;
}

const traderJoeApyAggregator = async (event) => {

  const { browser, page } = await newChrome();

  // fetch APYs for Avalanche and Arbitrum
  for (const [network, pools] of Object.entries(traderJoeConfig)) {
    for (const [pool, poolData] of Object.entries(pools)) {
      // navigate pools page and wait till javascript fully load.
      const URL = `https://traderjoexyz.com/${network}/pool/v21/`;

      await page.setViewport({
        width: 1920,
        height: 1080
      });

      await page.goto(URL + `${poolData.assetX}/${poolData.assetY}/${poolData.binStep}`, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      try {
        const tabs = await page.$$(".chakra-tabs__tab");
        const analyticsTab = (await (await tabs[6].getProperty('textContent')).jsonValue()).trim();
        console.log(analyticsTab);

        if (analyticsTab == "Analytics") {
          await tabs[6].click();
        } else {
          await tabs[5].click();
        }

        await new Promise((resolve, reject) => setTimeout(resolve, 5000));

        const stats = await page.$$(".chakra-stat__number");
        const apy = (await (await stats[3].getProperty('textContent')).jsonValue()).replace('%', '');
        console.log(pool, apy);

        const params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: pool
          },
          AttributeUpdates: {
            lp_apy: {
              Value: Number(apy) ? apy / 100 : null,
              Action: "PUT"
            }
          }
        };
        await dynamoDb.update(params).promise();
        await new Promise((resolve, reject) => setTimeout(resolve, 15000));
      } catch (error) {
        console.log(error);
      }
    }
  }

  // await browser.close();

  console.log('fetching done.');

  return event;
}

const sushiApyAggregator = async (event) => {

  const { browser, page } = await newChrome();

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
      console.log(pool, apy);

      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: levelConfig[lpInfo.name].symbol
        },
        AttributeUpdates: {
          tvl: {
            Value: Number(liquidityInUsd) ? liquidityInUsd : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
    }

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const glpAprAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {
    // parse GLP APR from GMX website
    const URL = "https://gmx.io/";

    const {browser, page} = await newChrome();

    // navigate gmx website and wait till fully load
    await page.goto(URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });
    // wait until the apy element load
    // const glpApySelector = "div.Home-token-card-option-apr";
    // await page.mainFrame().waitForFunction(
    //   selector => !!document.querySelector(selector).innerText,
    //   {},
    //   glpApySelector
    // )

    const {avaApy, arbApy} = await page.evaluate(() => {
      // select the elements with relevant class
      const items = document.querySelectorAll(".Home-token-card-option-apr");

      // parse APR of GLP on Avalanche
      const avaApy = parseFloat(items[items.length - 1].innerText.split(':').at(-1).trim().replaceAll('%', ''));
      const arbApy = parseFloat(items[items.length - 1].innerText.split(',')[0].split(':').at(-1).trim().replaceAll('%', ''));
      return {
        avaApy,
        arbApy
      };
    });
    console.log(avaApy, arbApy);

    const params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "GLP"
      },
      AttributeUpdates: {
        apy: {
          Value: Number(avaApy) ? avaApy : null,
          Action: "PUT"
        },
        arbApy: {
          Value: Number(arbApy) ? arbApy : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();
    // To-do: close() blocks execution. chromium version compatibility or something.
    // await browser.close();

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const vectorApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {
    const URL = "https://vectorfinance.io/pools";

    const {browser, page} = await newChrome();

    // navigate pools page and wait till javascript fully load.
    await page.goto(URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });
    // wait until the apy element load
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

    console.log("AVAX", avaxApy);
    console.log("sAVAX", savaxApy);
    console.log("USDC", usdcApy);
    console.log("USDT", usdtApy);

    // update APYs in db
    let params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "AVAX"
      },
      AttributeUpdates: {
        VF_AVAX_SAVAX_AUTO: {
          Value: Number(avaxApy) ? avaxApy / 100 : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();

    params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "sAVAX"
      },
      AttributeUpdates: {
        VF_SAVAX_MAIN_AUTO: {
          Value: Number(savaxApy) ? savaxApy / 100 : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();

    params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "USDC"
      },
      AttributeUpdates: {
        VF_USDC_MAIN_AUTO: {
          Value: Number(usdcApy) ? usdcApy / 100 : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();

    params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "USDT"
      },
      AttributeUpdates: {
        VF_USDT_MAIN_AUTO: {
          Value: Number(usdtApy) ? usdtApy / 100 : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();
    // await browser.close();

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const lpAndFarmApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const VECTOR_APY_URL = "https://vector-api-git-overhaul-vectorfinance.vercel.app/api/v1/vtx/apr";
    const YIELDYAK_APY_AVA_URL = "https://staging-api.yieldyak.com/apys";
    const YIELDYAK_APY_ARB_URL = "https://staging-api.yieldyak.com/42161/apys";

    // fetching lp APYs
    for (const [asset, data] of Object.entries(lpAssets)) {
      let apy;

      try {
        if (data.dex === "Pangolin") {
          apy = await fetchPangolinLpApr(data.url);
        } else if (data.dex === "TraderJoe") {
          apy = await fetchTraderJoeLpApr(tokenAddresses[asset], data.appreciation);
        }
      } catch (error) {
        console.log(`Fetching ${asset} APY failed. Error: ${error}`);
      }
      ;

      console.log(asset, apy);

      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: asset
        },
        AttributeUpdates: {
          lp_apy: {
            Value: Number(apy) ? apy : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
    }

    console.log(`Fetching lp APYs finished.`);

    // fetching farm APYs
    const apys = {};
    const urls = [
      VECTOR_APY_URL,
      YIELDYAK_APY_AVA_URL,
      YIELDYAK_APY_ARB_URL
    ];

    try {
      await Promise.all(urls.map(url =>
        fetch(url).then(resp => resp.json())
      )).then(async ([vectorAprs, yieldYakAvaApys, yieldYakArbApys]) => {

        if (!vectorAprs["Staking"]) console.log('APRs not available from Vector.');
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
          const attributes = {};

          for (const [identifier, apy] of Object.entries(apyData)) {
            attributes[identifier] = {
              Value: Number(apy) ? apy : null,
              Action: "PUT"
            }
          }

          params = {
            TableName: process.env.APY_TABLE,
            Key: {
              id: token
            },
            AttributeUpdates: attributes
          };
          await dynamoDb.update(params).promise();
        }

        console.log(`Fetching farm APYs finished.`);
      });

    } catch (error) {
      console.log(`Fetching farm APYs failed. Error: ${error}`);
    }

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const steakHutApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const URL = "https://app.steakhut.finance/pool/";

    const {browser, page} = await newChrome();

    for (const [asset, address] of Object.entries(steakHutApyConfig)) {

      // navigate pools page and wait till javascript fully load.
      await page.goto(URL + address, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      console.log("parsing APR (7-Day)...");

      const apy = await page.evaluate(() => {
        const fields = document.querySelectorAll(".chakra-heading");
        return fields[1].innerText.replace("%", "").trim();
      });

      console.log(asset, apy)

      // update APY in db
      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: asset
        },
        AttributeUpdates: {
          apy: {
            Value: Number(apy) ? apy / 100 : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
    }

    // await browser.close();

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const traderJoeApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const {browser, page} = await newChrome();

    // fetch APYs for Avalanche and Arbitrum
    for (const [network, pools] of Object.entries(traderJoeConfig)) {
      for (const [pool, poolData] of Object.entries(pools)) {
        // navigate pools page and wait till javascript fully load.
        const URL = `https://traderjoexyz.com/${network}/pool/v21/`;

        await page.setViewport({
          width: 1920,
          height: 1080
        });

        await page.goto(URL + `${poolData.assetX}/${poolData.assetY}/${poolData.binStep}`, {
          waitUntil: "networkidle0",
          timeout: 60000
        });

        try {
          const tabs = await page.$$(".chakra-tabs__tab");
          console.log(await (await tabs[6].getProperty('textContent')).jsonValue());
          await tabs[6].click();

          await new Promise((resolve, reject) => setTimeout(resolve, 5000));

          const stats = await page.$$(".chakra-stat__number");
          const apy = (await (await stats[3].getProperty('textContent')).jsonValue()).replace('%', '');
          console.log(pool, apy);

          const params = {
            TableName: process.env.APY_TABLE,
            Key: {
              id: pool
            },
            AttributeUpdates: {
              lp_apy: {
                Value: Number(apy) ? apy / 100 : null,
                Action: "PUT"
              }
            }
          };
          await dynamoDb.update(params).promise();
          await new Promise((resolve, reject) => setTimeout(resolve, 15000));
        } catch (error) {
          console.log(error);
        }
      }
    }

    // await browser.close();

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const sushiApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const {browser, page} = await newChrome();

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
        console.log(pool, apy);

        const params = {
          TableName: process.env.APY_TABLE,
          Key: {
            id: pool
          },
          AttributeUpdates: {
            lp_apy: {
              Value: Number(apy) ? apy : null,
              Action: "PUT"
            }
          }
        };
        await dynamoDb.update(params).promise();
      }
    }

    // await browser.close();

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const beefyApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {
    const {browser, page} = await newChrome();

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

          console.log(poolData.symbol, apy);

          const params = {
            TableName: process.env.APY_TABLE,
            Key: {
              id: poolData.symbol
            },
            AttributeUpdates: {
              [poolData.protocolIdentifier]: {
                Value: Number(apy) ? apy / 100 : null,
                Action: "PUT"
              }
            }
          };
          await dynamoDb.update(params).promise();
        }
      }
    }

    // await browser.close();

    console.log('fetching done.');

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const levelApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const levelApiUrl = "https://api.level.finance/v2/stats/liquidity-performance";
    const redstoneFeedUrl = "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod";

    const redstonePriceDataRequest = await fetch(redstoneFeedUrl);
    const redstonePriceData = await redstonePriceDataRequest.json();

    // fetch APYs from Level on Arbitrum
    const resp = await fetch(levelApiUrl);
    const liquidityPerformance = await resp.json();

    const arbLP = liquidityPerformance.find(item => item.chainId == 42161);
    for (const lpInfo of arbLP.lpInfos) {
      // const liquidityInUsd = formatUnits(lpInfo.totalSupply, 18) * formatUnits(lpInfo.price, 12);

      // let tradingFees = 0;

      // for (const [address, fees] of Object.entries(lpInfo.feeDetailsPerWeek)) {
      //   Object.values(fees).forEach(fee => {
      //     tradingFees += formatUnits(fee, levelConfig.lpSymbols[address].decimals) * redstonePriceData[levelConfig.lpSymbols[address].symbol][0].dataPoints[0].value;
      //   });
      // }

      // const profit =
      //   (formatUnits(lpInfo.lvlRewards, 18) * formatUnits(lpInfo.lvlPrice, 12)) +
      //   formatUnits(lpInfo.mintingFee, 6) +
      //   formatUnits(lpInfo.pnlVsTrader, 30) +
      //   tradingFees;

      // const apy = profit / liquidityInUsd / 7 * 365 * 100;
      const apy = formatUnits(lpInfo.feeApr, 8) + formatUnits(lpInfo.rewardApr, 8);
      console.log(levelConfig[lpInfo.name].symbol, levelConfig[lpInfo.name].protocolIdentifier, apy);

      const params = {
        TableName: process.env.APY_TABLE,
        Key: {
          id: levelConfig[lpInfo.name].symbol
        },
        AttributeUpdates: {
          [levelConfig[lpInfo.name].protocolIdentifier]: {
            Value: Number(apy) ? apy : null,
            Action: "PUT"
          }
        }
      };
      await dynamoDb.update(params).promise();
    }

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const gmxApyAggregator = async (event) => {

  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const {page} = await newChrome();

    // navigate pools page and wait till javascript fully load.
    const URL = "https://app.gmx.io/#/pools";

    await page.setViewport({
      width: 1920,
      height: 1080
    });

    await page.goto(URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    // fetch GM tokens' APYs on Arbitrum and Avalanche
    for (const [network, pools] of Object.entries(gmxApyConfig)) {
      if (network == "avalanche") {
        const networkBtn = await page.$$(".network-dropdown");

        await networkBtn[0].click();

        await page.mainFrame().waitForFunction(
          selector => !!document.querySelector(selector).innerText,
          {},
          "div.network-dropdown-list"
        )

        const dropdownBtns = await page.$$("div.network-dropdown-list > .network-dropdown-menu-item");

        await dropdownBtns[1].click();

        await page.goto(URL, {
          waitUntil: "networkidle0",
          timeout: 60000
        });
      }

      const marketRows = await page.$$(".token-table > tbody > tr");
      const marketInnerTexts = await Promise.all(Array.from(marketRows).map(async market => {
        return (await (await market.getProperty("textContent")).jsonValue()).replace(/\s+/g, "");
      }));

      for (const [poolId, marketId] of Object.entries(pools)) {
        try {
          const matchId = marketInnerTexts.findIndex(innerText => innerText.startsWith(marketId));
          const market = marketRows[matchId];
          const marketColumns = await market.$$("td");
          const marketApy = parseFloat((await (await marketColumns[5].getProperty("textContent")).jsonValue()).split('%')[0].trim());

          console.log(poolId, marketApy);

          const params = {
            TableName: process.env.APY_TABLE,
            Key: {
              id: poolId
            },
            AttributeUpdates: {
              lp_apy: {
                Value: Number(marketApy) ? marketApy / 100 : null,
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
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const fetchAssetApy = async () => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    // fetch staking APR of sAVAX and yyAVAX
    const sAvaxApiUrl = "https://api.benqi.fi/liquidstaking/apr";
    const yyAvaxApiUrl = "https://staging-api.yieldyak.com/yyavax";

    const apiUrls = [
      sAvaxApiUrl,
      yyAvaxApiUrl
    ];

    const [sAvaxApiRes, yyAvaxApiRes] = await Promise.all(
      apiUrls.map(url => fetch(url).then(resp => resp.json())
      ));

    const sAvaxApr = sAvaxApiRes["apr"] * 100;
    const yyAvaxApr = yyAvaxApiRes["yyAVAX"]['apr'];
    console.log("sAVAX APR: ", sAvaxApr);
    console.log("yyAVAX APR: ", yyAvaxApr);

    // fetch staking APR of ggAVAX
    const {page} = await newChrome();
    const GGP_URL = "https://multisiglabs.grafana.net/public-dashboards/4d21b06344684b8ab05ddd2828898ec8?orgId=1";

    await page.setViewport({
      width: 1920,
      height: 1080
    });

    await page.goto(GGP_URL, {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    const panels = await page.$$(".react-grid-layout > .react-grid-item");
    const ggAvaxApr = parseFloat((await (await panels[2].getProperty("textContent")).jsonValue()).split('APR')[1].split('%')[0].trim());
    console.log("ggAVAX APR: ", ggAvaxApr);

    return {
      sAvaxApr,
      yyAvaxApr,
      ggAvaxApr
    }
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const balanerApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const {sAvaxApr, yyAvaxApr, ggAvaxApr} = await fetchAssetApy();
    const assetAprs = {
      "avalanche": {
        "BAL_ggAVAX_AVAX": ggAvaxApr,
        "BAL_yyAVAX_AVAX": yyAvaxApr,
        "BAL_sAVAX_AVAX": sAvaxApr
      }
    };

    const {page} = await newChrome();

    // navigate pools page and wait till javascript fully load.
    const BASE_URL = "https://app.balancer.fi/#";

    await page.setViewport({
      width: 1920,
      height: 1080
    });

    // fetch GM tokens' APYs on Arbitrum and Avalanche
    for (const [network, pools] of Object.entries(balancerApyConfig)) {
      const PAGE_URL = `${BASE_URL}/${network}`;
      await page.goto(PAGE_URL, {
        waitUntil: "networkidle0",
        timeout: 60000
      });

      const poolRows = await page.$$("table > tr");
      const poolInnerTexts = await Promise.all(Array.from(poolRows).map(async pool => {
        return (await (await pool.getProperty("textContent")).jsonValue()).replace(/\s+/g, "").replace('Inyourwallet...0', '').replace('$0.00', '');
      }));

      for (const [identifier, keyword] of Object.entries(pools)) {
        try {
          const matchId = poolInnerTexts.findIndex(innerText => innerText.toLowerCase().startsWith(keyword));
          const pool = poolRows[matchId];
          const poolColumns = await pool.$$("td");

          const assetAppreciation = assetAprs[network][identifier] / 2;
          const vaultApy = parseFloat((await (await poolColumns[4].getProperty("textContent")).jsonValue()).split('%')[0].trim());
          const poolApy = ((1 + vaultApy / 100.0) * (1 + assetAppreciation / 100.0) - 1) * 100;

          console.log(identifier, vaultApy, poolApy);

          const params = {
            TableName: process.env.APY_TABLE,
            Key: {
              id: identifier
            },
            AttributeUpdates: {
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
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

const assetStakingApyAggregator = async (event) => {
  if (window.disableExternalData) {
    return firstValueFrom(EMPTY);
  }

  try {

    const {sAvaxApr, yyAvaxApr, ggAvaxApr} = await fetchAssetApy();

    let params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "sAVAX"
      },
      AttributeUpdates: {
        apy: {
          Value: Number(sAvaxApr) ? sAvaxApr : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();

    params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "yyAVAX"
      },
      AttributeUpdates: {
        apy: {
          Value: Number(yyAvaxApr) ? yyAvaxApr : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();

    params = {
      TableName: process.env.APY_TABLE,
      Key: {
        id: "ggAVAX"
      },
      AttributeUpdates: {
        apy: {
          Value: Number(ggAvaxApr) ? ggAvaxApr : null,
          Action: "PUT"
        }
      }
    };
    await dynamoDb.update(params).promise();

    return event;
  } catch (e) {
    window.disableExternalData = true;
    return firstValueFrom(EMPTY);
  }
}

module.exports = {
  levelTvlAggregator,
  glpAprAggregator,
  vectorApyAggregator,
  lpAndFarmApyAggregator,
  steakHutApyAggregator,
  traderJoeApyAggregator,
  sushiApyAggregator,
  beefyApyAggregator,
  levelApyAggregator,
  gmxApyAggregator,
  balanerApyAggregator,
  assetStakingApyAggregator
}
