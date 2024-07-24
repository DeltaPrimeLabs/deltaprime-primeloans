const ethers = require('ethers');

const {
    fromWei,
    arbitrumHistoricalProvider,
    getWrappedContractsHistorical,
    getArweavePackages,
} = require('../utils/helpers');
const loanAbi = require('../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json')
const fs = require("fs");

const AFFECTED_ACCOUNTS = {
    "0x3c6DfB5D608c4849d289d81d8bfcCBD48d86d0a8": 234910548,
    "0x14f69F9C351b798dF31fC53E33c09dD29bFAb547": 234921433,
    "0x944496b6B25f94d5d0bd9dFb60F5532dac211A20": 234938151,
    "0xACc3F29902FE029e7D0Ebb66B28B282ddc4b9f26": 234938703,
    "0x35489cDcc57b7eCB0333F504B2Fe60828309a97E": 234939589,
    "0x96C94E710690FAF6Ca4b0EF6e129B8de1F3001E2": 234940434,
    "0xeE03A69A2C787D9A560172176524B4409723cCb4": 234940822,
    "0xC8160b24922664d9b3CF7f0acBC149dC33917d15": 234941641,
    "0xf4E6232d2f86Bd3399D956b3892d6B1893e1e06E": 234959246,
    "0x81262DfC30A5E3Ae137029F20850566F86f6eB3A": 234976218,
    "0xE18C25BFb89596AF5B13FDE5E9676e6C19fE5D20": 234989560,
    "0x50418699cB44BfDa9c9afc9B7a0b0d244d8927D2": 234989610,
    "0x96645412c8D1981b8104DC99E84996276c7D9435": 234991949,
    "0xED2A1F4b1b1BfFD86c6Ab72A55c0F7d21b00D207": 234993962,
    "0xB97D1BFa5c0cb2b776EACa2050B4Ff6e5DF486E6": 234994919,
    "0x9e0C163c5D07AE90c8F805165864D583bbAE6b17": 234995741,
    "0xcDA5a93Dd9947b6FF11dB866fE90ca79d033ADD9": 234997024,
    "0x0e2852b070fbF866acecb93DeC04b91F02804cFE": 234998506,
    "0xDd64DCFcA556198dcbEf3Fc09Ee40E61BD716b0b": 234999754,
    "0x4512d1577517a46fc81111F8db4fA286B38D3Ee4": 235001590,
    "0xC152Cd87af2b3774e93ed2ad2523c90C576db5fA": 235002883,
    "0x4726464FB17727cb6C7aAab2451F7229C94BfdC4": 235003084,
}

async function runMethod(contract, methodName, blockNumber) {
    const tx = await contract.populateTransaction[methodName]()
    let res = await contract.provider.call(tx, blockNumber)
    return contract.interface.decodeFunctionResult(
        methodName,
        res
    )[0];
}

function convertToCsv(rows, filename) {
    let data = '';

    for (let row of rows) {
        for (let selector of rows) {
            data += `${row}\n`;
        }
    }

    fs.writeFileSync(filename, data, 'utf8');
}

async function checkPACollateral(paAddress, block){
    const blockInfo = await arbitrumHistoricalProvider.getBlock(block);
    const timestamp = blockInfo.timestamp;

    const packages = await getArweavePackages(timestamp, 'arbitrum');
    const [wrappedContract] = await getWrappedContractsHistorical([paAddress], 'arbitrum', packages);


    const totalValue = fromWei(await runMethod(wrappedContract, 'getTotalValue', block));
    const debt = fromWei(await runMethod(wrappedContract, 'getDebt', block));

    const collateral = totalValue - debt;
    console.log(`Account: ${paAddress}, Collateral: ${collateral}, block: ${block}`)
}


async function run() {

    let collaterals = [];
    for (let [account, block] of Object.entries(AFFECTED_ACCOUNTS)) {
        collaterals.push(await checkPACollateral(account, block));
        break;
    }

    console.log(collaterals)
    convertToCsv(collaterals, 'collaterals-affected-acounts.csv')
}

run();
