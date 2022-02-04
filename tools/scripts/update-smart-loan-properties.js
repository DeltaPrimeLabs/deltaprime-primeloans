import POOL from "../../build/contracts/Pool.json";
import EXCHANGE from "../../build/contracts/PangolinExchange.json";
import config from "../../src/config.js";

export function main() {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/SmartLoanProperties.sol', 'utf8')

    let result = data.replace(/_POOL_ADDRESS = .*;/g,
            '_POOL_ADDRESS = ' + POOL.networks[config.chainId].address + ';');

    result = result.replace(/_EXCHANGE_ADDRESS = .*;/g,
            '_EXCHANGE_ADDRESS = ' + EXCHANGE.networks[config.chainId].address + ';');

    fs.writeFileSync('./contracts/SmartLoanProperties.sol', result, 'utf8');

    return 'Properties updated!'
}

main();
