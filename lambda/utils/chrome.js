module.exports.newChrome = async () => {
  let browser;

  if (process.env.IS_LOCAL) {
    const puppeteer = require("puppeteer");
    browser = await puppeteer.launch({headless: false});
  } else {
    const puppeteer = require('puppeteer-extra')

    // Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
    const StealthPlugin = require('puppeteer-extra-plugin-stealth')
    puppeteer.use(StealthPlugin())

    const chromium = require("@sparticuz/chromium");

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
  }

  const page = await browser.newPage();

  return {
    browser,
    page
  };
}
