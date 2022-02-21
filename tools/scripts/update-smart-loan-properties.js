export default function updateSmartLoanProperties(poolAddress, exchangeAddress) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/SmartLoanProperties.sol', 'utf8')

    let result = data.replace(/_POOL_ADDRESS = .*;/g,
            '_POOL_ADDRESS = ' + poolAddress + ';');

    result = result.replace(/_EXCHANGE_ADDRESS = .*;/g,
            '_EXCHANGE_ADDRESS = ' + exchangeAddress + ';');

    fs.writeFileSync('./contracts/SmartLoanProperties.sol', result, 'utf8');

    return 'Properties updated!'
}