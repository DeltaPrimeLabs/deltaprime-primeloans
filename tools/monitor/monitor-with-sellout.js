const Loans = require('../loans.js');
const args = require('yargs').argv;

let interval = args.interval ? args.interval : 10;

console.log(`Monitoring loans with ${interval} seconds interval`);
async function monitorAndSellout() {
  let loans = await Loans.findAllLoans();

  loans.forEach( async loanAddress => {
    let status = await Loans.getLoanStatus(loanAddress);
    if (!status.isSolvent) {
      console.log("Insolvent loan found: " + loanAddress);
      console.log(status);
      await Loans.loanSellout(loanAddress);
    }
  });
  setTimeout(monitorAndSellout, interval * 1000);
}


monitorAndSellout();
