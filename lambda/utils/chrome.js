module.exports.newChrome = async () => {
  let browser;

  // if (process.env.IS_LOCAL) {
  //   const puppeteer = require("puppeteer");
  //   browser = await puppeteer.launch({headless: false});
  // } else {
  const puppeteer = require("puppeteer-core");
  const chromium = require("@sparticuz/chromium");

  browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: null,
    ignoreHTTPSErrors: true,
  });
  // }

  const page = await browser.newPage();

  return {
    browser,
    page
  };
}
