const Loans = require('./loans.js');
const PriceOracle = require('./price-oracle.js');


async function run() {
  let loan = await Loans.createLoan();
  await Loans.fundLoan(loan, 0.1);
  await Loans.borrowFromPool(loan, 0.3);
  await PriceOracle.setPrice('USD', 1);
  await Loans.invest(loan, 'USD', 0.1);
  await PriceOracle.setPrice('USD', 0.5);
  let status = await Loans.getLoanStatus(loan);
  console.log(status);
}


run();
