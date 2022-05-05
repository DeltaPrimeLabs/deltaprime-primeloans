export default function updateSmartLoanProperties(indices, poolMap, exchangeAddress, yieldYakRouter) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/SmartLoanProperties.sol', 'utf8')

    let fileArray = data.split('\n');

    //getPoolsAssetsIndices()

    let previousLine = fileArray.findIndex(
        line => line.includes('getPoolsAssetsIndices')
    );

    fileArray[previousLine] = fileArray[previousLine].replace(/uint8\[(.*)\]/, `uint8[${indices.length}]`);

    let newLine = `    return [${indices.toString()}];`;

    fileArray.splice(previousLine + 1, 1, newLine);



    //getPoolAddress()

    previousLine = fileArray.findIndex(
        line => line.includes('function getPoolAddress')
    );

    fileArray = fileArray.filter(
        line => {
            return !line.includes('if (poolToken == bytes32(');
        }
    );

    let newLines = [];

    Object.entries(poolMap).forEach(
        ([symbol, address]) => {
            newLines.push(`    if (poolToken == bytes32("${symbol}")) return ${address};`);
        }
    );

    fileArray.splice(previousLine + 1, 0, ...newLines);

    //_EXCHANGE_ADDRESS

    previousLine = fileArray.findIndex(
        line => line.includes('_EXCHANGE_ADDRESS =')
    );

    newLine = `  address private constant _EXCHANGE_ADDRESS = ${exchangeAddress};`;

    fileArray.splice(previousLine, 1, newLine);

    //Yak Router

    previousLine = fileArray.findIndex(
        line => line.includes('return IYieldYakRouter')
    );

    newLine = `  return IYieldYakRouter(${yieldYakRouter});`;

    fileArray.splice(previousLine, 1, newLine);

    let result = fileArray.join("\n");

    fs.writeFileSync('./contracts/SmartLoanProperties.sol', result, 'utf8');

    return 'Properties updated!'
}