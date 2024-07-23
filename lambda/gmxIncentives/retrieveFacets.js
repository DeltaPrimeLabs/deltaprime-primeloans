const ethers = require('ethers');

const {
    arbitrumHistoricalProvider,
    avalancheHistoricalProvider,
} = require('../utils/helpers');
const loanAbi = require('../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json')

async function runMethod(contract, methodName, blockNumber) {
    const tx = await contract.populateTransaction[methodName]()
    let res = await contract.provider.call(tx, blockNumber)
    return contract.interface.decodeFunctionResult(
        methodName,
        res
    )[0];
}

async function getFacets() {
    const arbDiamond = new ethers.Contract("0x62Cf82FB0484aF382714cD09296260edc1DC0c6c", loanAbi.abi, arbitrumHistoricalProvider);
    const arbFacets = await runMethod(arbDiamond, 'facets', 235008030);
    console.log('Arbitrum Facets', arbFacets);

    const avaxDiamond = new ethers.Contract("0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D", loanAbi.abi, avalancheHistoricalProvider);
    const avaxFacets = await runMethod(avaxDiamond, 'facets', 48310125);
    console.log('Avalanche Facets', avaxFacets);
}

getFacets()
