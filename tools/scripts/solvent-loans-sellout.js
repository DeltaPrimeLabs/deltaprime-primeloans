const Loans = require('../loans.js');

async function selloutAllLoans() {
  let loans = await Loans.findAllLoans();
  console.log(`Found ${loans.length} loans. Attempting to sell all of them out.`)
  loans.forEach( async loanAddress => {
    await Loans.selloutSolventLoan(loanAddress);
  });
}

selloutAllLoans();
