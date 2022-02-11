const loans = require('./loans');
const LOAN = require('../../build/contracts/SmartLoan.json');
const ethers = require("ethers");
const fs = require("fs");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
provider = new ethers.providers.JsonRpcProvider();
let wallet = mnemonicWallet.connect(provider);

loans.findAllLoans().then(
    loans => {
        let loan1 = loans[0];
        let loan = new ethers.Contract(loan1, LOAN.abi, wallet);
        loan.getMaxLtv().then(
            res => {
                console.log(res.toString());
            }
        )
    }
)

