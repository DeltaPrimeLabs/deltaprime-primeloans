export default function updateSmartLoanProperties(poolAddress, exchangeAddress, yieldYakRouter) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/SmartLoanProperties.sol', 'utf8')

    let result = data.replace(/return Pool(.*);/g,
        'return Pool(' + poolAddress + ');');

    result = result.replace(/return IYieldYakRouter(.*);/g,
        'return IYieldYakRouter(' + yieldYakRouter + ');');

    result = result.replace(/_EXCHANGE_ADDRESS = .*;/g,
        '_EXCHANGE_ADDRESS = ' + exchangeAddress + ';');

    fs.writeFileSync('./contracts/SmartLoanProperties.sol', result, 'utf8');

    return 'Properties updated!'
}
