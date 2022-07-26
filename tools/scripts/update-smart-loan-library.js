export default function updateSmartLoanLibrary(pangolinRouterAddress, poolManager, redstoneConfigManager, diamondBeaconAddress, maxLTV, minSelloutLTV) {
    var fs = require('fs')
    let data = fs.readFileSync('./contracts/lib/SmartLoanLib.sol', 'utf8')

    let fileArray = data.split('\n');

    // MaxLTV

    let lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_MAX_LTV =')
    );

    let newLine = `    uint256 private constant _MAX_LTV = ${maxLTV};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //MinSelloutLTV

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_MIN_SELLOUT_LTV =')
    );

    newLine = `    uint256 private constant _MIN_SELLOUT_LTV = ${minSelloutLTV};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //Pangolin Router

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('address private constant _PANGOLIN_ROUTER_CONTRACT')
    );

    newLine = `    address private constant _PANGOLIN_ROUTER_CONTRACT = ${pangolinRouterAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //Pool Manager

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('return PoolManager')
    );

    newLine = `    return PoolManager(${poolManager});`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //Redstone Config Manager

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('return RedstoneConfigManager')
    );

    newLine = `    return RedstoneConfigManager(${redstoneConfigManager});`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    //SolvencyFacetAddress

    lineWithFunctionDeclaration = fileArray.findIndex(
        line => line.includes('_DIAMOND_BEACON_ADDRESS =')
    );

    newLine = `    address private constant _DIAMOND_BEACON_ADDRESS = ${diamondBeaconAddress};`;

    fileArray.splice(lineWithFunctionDeclaration, 1, newLine);

    let result = fileArray.join("\n");

    fs.writeFileSync('./contracts/lib/SmartLoanLib.sol', result, 'utf8');

    return 'lib/SmartLoanLib.sol updated!'
}