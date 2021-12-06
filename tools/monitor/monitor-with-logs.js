const Loans = require('../loans.js');
const args = require('yargs').argv;

let interval = args.interval ? args.interval : 5;

console.log(`Monitoring loans with ${interval} seconds interval`);

async function monitor() {
  let loans = await Loans.findAllLoans();
  if (loans.length === 0) {
    console.log("There are no loans yet")
  } else if (loans.length === 1) {
    console.log("There is 1 smart loan:");
  } else {
    console.log(`There are ${loans.length} smart loans:`);
  }
  loans.forEach( async loanAddress => {
    let status = await Loans.getLoanStatus(loanAddress);
    status.address = loanAddress;
    console.log(status);
  });
  setTimeout(monitor, interval * 1000);
}


monitor();
