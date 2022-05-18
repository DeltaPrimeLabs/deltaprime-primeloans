export default function updateSmartLoanLibrary(poolTokenIndices, poolTokenAddresses, poolMap, exchangeAddress, yieldYakRouter, maxLTV, minSelloutLTV) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/lib/SmartLoanLib.sol', 'utf8')

    let fileArray = data.split('\n');


    //getPoolsAssetsIndices()
    let lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('getPoolsAssetsIndices')
    );

    fileArray[lineWithFunctionDeclaration] = fileArray[lineWithFunctionDeclaration].replace(/uint8\[(.*)\]/, `uint8[${poolTokenIndices.length}]`);

    let newLine = `    return [${poolTokenIndices.toString()}];`;

    fileArray.splice(lineWithFunctionDeclaration + 1, 1, newLine);


    //getPoolTokens()
    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('function getPoolTokens')
    );

    fileArray = fileArray.filter(
        line => {
            return !line.includes('IERC20Metadata(');
        }
    );

    fileArray[lineWithFunctionDeclaration] = fileArray[lineWithFunctionDeclaration].replace(/IERC20Metadata\[(.*)\]/, `IERC20Metadata[${poolTokenAddresses.length}]`);

    let newLines = poolTokenAddresses.map(
        (address, i) => `      IERC20Metadata(${address})${i !== poolTokenAddresses.length - 1 ? ',' : ''}`
    )

    fileArray.splice(lineWithFunctionDeclaration + 2, 0, ...newLines);


    //getPools()

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('function getPools(')
    );

    fileArray = fileArray.filter(
        line => {
            return !line.includes('ERC20Pool(');
        }
    );

    fileArray[lineWithFunctionDeclaration] = fileArray[lineWithFunctionDeclaration].replace(/ERC20Pool\[(.*)\]/, `ERC20Pool[${poolTokenAddresses.length}]`);

    newLines = [];

    Object.entries(poolMap).forEach(
        ([symbol, address], i) => {
            newLines.push(`      ERC20Pool(${address})${i !== Object.entries(poolMap).length - 1 ? ',' : ''}`);
        }
    );

    fileArray.splice(lineWithFunctionDeclaration + 2, 0, ...newLines);


    //getPoolAddress()

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('function getPoolAddress')
    );

    fileArray = fileArray.filter(
        line => {
            return !line.includes('if (poolToken == bytes32(');
        }
    );

    newLines = [];

    Object.entries(poolMap).forEach(
        ([symbol, address]) => {
            newLines.push(`    if (poolToken == bytes32("${symbol}")) return ${address};`);
        }
    );

    fileArray.splice(lineWithFunctionDeclaration + 1, 0, ...newLines);

    //_EXCHANGE_ADDRESS

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_EXCHANGE_ADDRESS =')
    );

    newLine = `  address private constant _EXCHANGE_ADDRESS = ${exchangeAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //Yak Router

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('return IYieldYakRouter')
    );

    newLine = `  return IYieldYakRouter(${yieldYakRouter});`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    let result = fileArray.join("\n");

    fs.writeFileSync('./contracts/lib/SmartLoanLib.sol', result, 'utf8');

    return 'lib/SmartLoanLib.sol updated!'
}