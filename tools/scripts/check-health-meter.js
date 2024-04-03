import {WrapperBuilder} from "@redstone-finance/evm-connector";
import config from "../../src/config";
import CACHE_LAYER_URLS from "../../common/redstone-cache-layer-urls.json";
const fromWei = val => parseFloat(ethers.utils.formatEther(val));

const jsonRPC = "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf";
const FACTORY = require(`../../deployments/avalanche/SmartLoansFactory.json`);

const ARTIFACT = require(`../../artifacts/contracts/interfaces/SmartLoanGigaChadInterface.sol/SmartLoanGigaChadInterface.json`);
const ethers = require("ethers");
const fs = require("fs");

const key = fs.readFileSync("./.secret").toString().trim();
let mnemonicWallet = new ethers.Wallet(key);
let provider = new ethers.providers.JsonRpcProvider(jsonRPC);
let wallet = mnemonicWallet.connect(provider);

let factory = new ethers.Contract('0xFf5e3dDaefF411a1dC6CcE00014e4Bca39265c20', FACTORY.abi, provider);

export const wrapContract = async function wrapContract(contract, assets) {
    //for more symbols in data feed it's more optimal to not specify asset list
    const providedAssets = (assets && assets.length <= 5) ? assets : undefined;

    return WrapperBuilder.wrap(contract).usingDataService(
        {
            dataServiceId: "redstone-arbitrum-prod",
            uniqueSignersCount: 3,
            dataFeeds: providedAssets,
            disablePayloadsDryRun: true
        },
        CACHE_LAYER_URLS.urls
    );
};
run().then(() => console.log('Finished!'))

async function run() {
    let loans = [
        '0xFFb0815Bb9B8bCa8FAA250A9d28B7Ac347c11E31',
        '0x1e64dce40c52bbe4993aD07a58712a5120765a09',
        '0xf74Dfb08B599727400d53fe92197c9Ed310230A6',
        '0x4C2e68bF5905afa22f0B4a021E6C43Db3d81E9bf',
        '0x5Ef7cdfE1f79902b0E9F77352c451096Dd61eFb1',
        '0x26Af9CD205d60EF169a68B2fE7F90EAc58aB383e',
        '0xE28E92948A19e07CfCf664C0ee014E93dc59Ff6e',
        '0x52794F579E4d3D4a15a585aA545b4DEB8c440803',
        '0xbB932c78AF945721641c29fbA7794fDA537AEdE1'
    ];

    let wrongLoans = [];

    let i = 0;
    for (let address of loans) {
        let loan = new ethers.Contract(address, ARTIFACT.abi, wallet);
        let wrappedLoan = await wrapContract(loan);
        let res = await getData(wrappedLoan, i);
        if (res) {
            wrongLoans.push(res)
        }
        i++;
    }

    console.log('----------------------------------')
    console.log(`Wrong loans: ${wrongLoans.length}`);

    for (let loanInfo of wrongLoans) {
        let [address, calculatedHm, hm, hr] = loanInfo;
        console.log(`i: ${i}; Loan: ${address}; calculatedHm: ${calculatedHm}; hm: ${hm} hr: ${hr}`);
    }
}



async function getData(wrappedLoan, i) {
    console.log(i);

    let hr, hm;
    try {
        hr = fromWei(await wrappedLoan.getHealthRatio());
        hm = fromWei(await wrappedLoan.getHealthMeter()) / 100;
    } catch (e) {
        try {
            hr = fromWei(await wrappedLoan.getHealthRatio());
            hm = fromWei(await wrappedLoan.getHealthMeter()) / 100;
        } catch (e) {
            try {
                hr = fromWei(await wrappedLoan.getHealthRatio());
                hm = fromWei(await wrappedLoan.getHealthMeter()) / 100;
            } catch (e) {
                console.log(`Failed for loan: ${wrappedLoan.address}`)
            }
        }
    }



    let calculatedHm = (hr - 1) / (hr - 0.83333);

    console.log('hr: ', hr)
    console.log('hm: ', hm)
    console.log('calculatedHm: ', calculatedHm)

    if (Math.abs((hm - calculatedHm) / hm) > 0.01) {
        return [wrappedLoan.address, calculatedHm, hm, hr];
    }
}

