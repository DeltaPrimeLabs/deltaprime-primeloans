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
    "0xad5783Fb992BFee99732a5eBE5Ba301657Fb047E": 234910548,
    "0x10750001efb9c5AF263F650FB1f49Dd69C955CA0": 234921433,
    "0x6018e2752B64e31FDAc15d1eD5Dedf82566A484C": 234938151,
    "0xe5ED5AfaD6493E0cB63Dc42E1f3ABb9676378c4f": 234938703,
    "0x96E114D73AE220cbd2bD8Ce620BcfEA2e20B0C00": 234939589,
    "0x2B97706A7184FdDDdaEb70614b0a8fD35Fb54F60": 234940434,
    "0x9F1FD5458E0E465379E8aff9d1d825e2C13D2eCb": 234940822,
    "0xA9694B73d6614183138A697c7B7C99d9718d3Eca": 234941641,
    "0xba5C8630E224B8AF7b29BBDdb0435f07b6643190": 234959246,
    "0x2FfD0D2bEa8E922A722De83c451Ad93e097851F5": 234976218,
    "0x0b7DcF8E70cF0f9c73D2777d871F4eBD6150Bd3b": 234989560,
    "0x48285109D4b959608C8E9691cAb1aFc244a80D5F": 234989610,
    "0xCC5159C01C1bdAb6c607F800E71B84898597c9FE": 234991949,
    "0xfeD94826098d636c517F7F1021B37EB465b9FCE4": 234993962,
    "0x58c80413603841455b3C5abF08d6AA854F376086": 234994919,
    "0xc00bE32F7669A3417AD26DD41352418Fc49eB0F7": 234995741,
    "0x36a1bCcf37AF1E315888c2cA967B163c50B1D943": 234997024,
    "0xb9967f0e4ea928550E3d05B0e57a627AB0302108": 234998506,
    "0x7F23dc430AF70aBE865387d5b1FDC91c27daEcCB": 234999754,
    "0x35C93a488906798341ce4267Ecb398dC2aD230a6": 235001590,
    "0x0844F379be6E5b7Fd4A6D8f7A1b5146A68E23e9f": 235002883,
    "0xeAA7425910Af14657ED96a278274e6e85D947f2D": 235003084,
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
