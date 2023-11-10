const fetch = require("node-fetch");

const fetchPangolinLpApr = async (url) => {
  let apr;

  if (url) {
    const resp = await fetch(url);
    const json = await resp.json();

    apr = json.swapFeeApr;
  } else {
    apr = null;
  }

  return apr;
}

module.exports = {
  fetchPangolinLpApr
}