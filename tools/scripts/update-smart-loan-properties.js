export function updateContracts(poolAddress, exchangeAddress, maxLTV = 5000, minSelloutLTV = 4000) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/SmartLoanProperties.sol', 'utf8')

    let result = data.replace(/_POOL_ADDRESS = .*;/g,
            '_POOL_ADDRESS = ' + poolAddress + ';');

    result = result.replace(/_EXCHANGE_ADDRESS = .*;/g,
            '_EXCHANGE_ADDRESS = ' + exchangeAddress + ';');

    result = result.replace(/_return _MAX_LTV .*;/g,
        '_MAX_LTV = ' + maxLTV + ';');

    result = result.replace(/return _MIN_SELLOUT_LTV = .*;/g,
        '_MIN_SELLOUT_LTV = ' + minSelloutLTV + ';');

    fs.writeFileSync('./contracts/SmartLoanProperties.sol', result, 'utf8');

    return 'Properties updated!'
}