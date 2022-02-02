const Loans = require('../loans.js');
const args = require('yargs').argv;

let maxLTV = args.maxLTV ? args.maxLTV : 4000;

console.log(`Setting maximal LTV of all loans to ${maxLTV}`);

async function setMaximalLTV() {
  let loans = await Loans.findAllLoans();
  loans.forEach( async loanAddress => {
    await Loans.setMaxLTV(loanAddress, maxLTV);
  });
}


setMaximalLTV();
