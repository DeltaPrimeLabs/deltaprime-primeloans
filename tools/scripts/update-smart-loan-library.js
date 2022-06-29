export default function updateSmartLoanLibrary(poolTokenIndices, poolTokenAddresses, poolMap, exchangeAddress, yieldYakRouter, maxLTV, minSelloutLTV) {
    var fs = require('fs')
    let smartLoanLib = fs.readFileSync('./contracts/lib/SmartLoanLib.sol', 'utf8')
    let logicFacet = fs.readFileSync('./contracts/faucets/SmartLoanLogicFacet.sol', 'utf8')

    let libFileArray = smartLoanLib.split('\n');
    let facetFileArray = logicFacet.split('\n');


    //getPoolsAssetsIndices() - SmartLoanLib
    let lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('getPoolsAssetsIndices')
    );

    libFileArray[lineWithFunctionDeclaration] = libFileArray[lineWithFunctionDeclaration].replace(/uint8\[(.*)\]/, `uint8[${poolTokenIndices.length}]`);

    let newLine = `    return [${poolTokenIndices.toString()}];`;

    libFileArray.splice(lineWithFunctionDeclaration + 1, 1, newLine);

    //getPoolsAssetsIndices() - SmartLoanLogicFacet
    lineWithFunctionDeclaration = facetFileArray.findIndex(
        line => line.includes('getPoolsAssetsIndices')
    );

    facetFileArray[lineWithFunctionDeclaration] = facetFileArray[lineWithFunctionDeclaration].replace(/uint8\[(.*)\]/, `uint8[${poolTokenIndices.length}]`);

    //getPoolTokens()
    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('function getPoolTokens')
    );

    libFileArray = libFileArray.filter(
        line => {
            return !line.includes('IERC20Metadata(');
        }
    );

    libFileArray[lineWithFunctionDeclaration] = libFileArray[lineWithFunctionDeclaration].replace(/IERC20Metadata\[(.*)\]/, `IERC20Metadata[${poolTokenAddresses.length}]`);

    let newLines = poolTokenAddresses.map(
        (address, i) => `      IERC20Metadata(${address})${i !== poolTokenAddresses.length - 1 ? ',' : ''}`
    )

    libFileArray.splice(lineWithFunctionDeclaration + 2, 0, ...newLines);

    //getPoolTokens() - SmartLoanLogicFacet
    lineWithFunctionDeclaration = facetFileArray.findIndex(
        line => line.includes('getPoolTokens')
    );

    facetFileArray[lineWithFunctionDeclaration] = facetFileArray[lineWithFunctionDeclaration].replace(/IERC20Metadata\[(.*)\]/, `IERC20Metadata[${poolTokenAddresses.length}]`);


    //getPools()

    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('function getPools(')
    );

    libFileArray = libFileArray.filter(
        line => {
            return !line.includes('ERC20Pool(');
        }
    );

    libFileArray[lineWithFunctionDeclaration] = libFileArray[lineWithFunctionDeclaration].replace(/ERC20Pool\[(.*)\]/, `ERC20Pool[${poolTokenAddresses.length}]`);

    newLines = [];

    Object.entries(poolMap).forEach(
        ([symbol, address], i) => {
            newLines.push(`      ERC20Pool(${address})${i !== Object.entries(poolMap).length - 1 ? ',' : ''}`);
        }
    );

    libFileArray.splice(lineWithFunctionDeclaration + 2, 0, ...newLines);


    //getPoolAddress()

    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('function getPoolAddress')
    );

    libFileArray = libFileArray.filter(
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

    libFileArray.splice(lineWithFunctionDeclaration + 1, 0, ...newLines);

    //_EXCHANGE_ADDRESS

    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('_EXCHANGE_ADDRESS =')
    );

    newLine = `  address private constant _EXCHANGE_ADDRESS = ${exchangeAddress};`;

    libFileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    // MaxLTV

    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('_MAX_LTV =')
    );

    newLine = `    uint256 private constant _MAX_LTV = ${maxLTV};`;

    libFileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //MinSelloutLTV

    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('_MIN_SELLOUT_LTV =')
    );

    newLine = `    uint256 private constant _MIN_SELLOUT_LTV = ${minSelloutLTV};`;

    libFileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //Yak Router

    lineWithFunctionDeclaration = libFileArray.findIndex(
        line => line.includes('return IYieldYakRouter')
    );

    newLine = `  return IYieldYakRouter(${yieldYakRouter});`;

    libFileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    let resultLib = libFileArray.join("\n");
    let resultFacet = facetFileArray.join("\n");

    fs.writeFileSync('./contracts/lib/SmartLoanLib.sol', resultLib, 'utf8');
    fs.writeFileSync('./contracts/faucets/SmartLoanLogicFacet.sol', resultFacet, 'utf8');

    return 'lib/SmartLoanLib.sol updated!'
}