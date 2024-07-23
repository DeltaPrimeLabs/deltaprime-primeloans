import {Contract} from "ethers";

const ethers = require('ethers');

const {
    arbitrumHistoricalProvider,
    avalancheHistoricalProvider,
} = require('../utils/helpers');
const loanAbi = require('../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json')
const fs = require('fs');

async function runMethod(contract, methodName, blockNumber) {
    const tx = await contract.populateTransaction[methodName]()
    let res = await contract.provider.call(tx, blockNumber)
    return contract.interface.decodeFunctionResult(
        methodName,
        res
    )[0];
}

function getContractSelectors(contract){
    let selectors = {};
    contract.interface.fragments.forEach(fragment => {
        if (fragment.type === 'function') {
            // Construct the function signature
            const inputTypes = fragment.inputs.map(input => input.type).join(',');
            const signature = `${fragment.name}(${inputTypes})`;

            // Compute the selector
            const selector = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature)).slice(0, 10); // '0x' followed by the 4-byte selector
            selectors[selector] = fragment.name;
        }
    });

    return selectors;
}
function convertToCsv(facets, filename, selectors) {
    let data = '';

    for (let facetInfo of facets) {
        for (let selector of facetInfo.functionSelectors) {
            let methodName = selectors[selector];
            console.log(selectors)
            data += `${facetInfo.facetAddress},${selector}${methodName ? ',' + methodName : ''}\n`;
        }
    }

    fs.writeFileSync(filename, data, 'utf8');
}

async function getFacets() {
    const arbDiamond = new ethers.Contract("0x62Cf82FB0484aF382714cD09296260edc1DC0c6c", loanAbi.abi, arbitrumHistoricalProvider);

    let selectors = getContractSelectors(arbDiamond);
    const arbFacets = await runMethod(arbDiamond, 'facets', 235008030);
    convertToCsv(arbFacets, 'arb-facets.csv', selectors);


    const avaxDiamond = new ethers.Contract("0x2916B3bf7C35bd21e63D01C93C62FB0d4994e56D", loanAbi.abi, avalancheHistoricalProvider);
    const avaxFacets = await runMethod(avaxDiamond, 'facets', 48310125);
    convertToCsv(avaxFacets, 'avax-facets.csv', selectors);
}



getFacets()
