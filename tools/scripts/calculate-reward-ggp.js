const { ethers } = require('ethers');
const fs = require('fs');
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const toBytes32 = ethers.utils.formatBytes32String;

const APR = 539;
const PRECISION = 10000;
const daysInWeek = 7;
const daysInYear = 365;

const CACHE_LAYER_URLS ={
    "urls":
        [
            "https://oracle-gateway-1.a.redstone.finance",
            "https://oracle-gateway-2.a.redstone.finance"
        ]
};
// List of pools to analyze
const pools = [
    "WOMBAT_ggAVAX_AVAX_LP_AVAX",
    "WOMBAT_sAVAX_AVAX_LP_AVAX",
    "WOMBAT_sAVAX_AVAX_LP_sAVAX"
];

const smartLoanFactoryAbi = [
    "function getAllLoans() view returns (address[])",
];
const smartLoanAbi = [
    "function getTotalValue() view returns (uint256)",
    "function getDebt() view returns (uint256)",
    "function sAvaxBalanceAvaxSavaxYY() view returns (uint256)",
    "function ggAvaxBalanceAvaxGgavaxYY() view returns (uint256)",
    "function avaxBalanceAvaxSavaxYY() view returns (uint256)",
    "function avaxBalanceAvaxGgavaxYY() view returns (uint256)",
    "function getPrice(bytes32) view returns (uint256)",
];

function getProvider(){
    return new ethers.providers.JsonRpcProvider("https://rpc.ankr.com/avalanche");
}

function initWallet() {
    const wallet = ethers.Wallet.createRandom();
    // Get the private key
    const privateKey = wallet.privateKey;

    const provider = getProvider();

    return new ethers.Wallet(privateKey, provider);
}

function writeJSON(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 4), 'utf8');
}

async function getLoans() {
    try {
        const provider = getProvider();
        const smartLoanFactory = new ethers.Contract("0x3Ea9D480295A73fd2aF95b4D96c2afF88b21B03D", smartLoanFactoryAbi, provider);
        // Call the getAllLoans method to get all loan addresses
        const loans = await smartLoanFactory.getAllLoans();
        return loans; // Return the list of loan addresses
    } catch (error) {
        console.error("Error fetching loan addresses:", error);
    }
}

async function calculateRewards() {
    const results = [];
    const wallet = initWallet();
    const loans = await getLoans();

    for(let i = 0 ; i < loans.length; i ++) {
        const loanContract = new ethers.Contract(loans[i], smartLoanAbi, wallet);
        let loan = WrapperBuilder.wrap(loanContract).usingDataService(
            {
                dataServiceId: "redstone-avalanche-prod",
                uniqueSignersCount: 3,
                disablePayloadsDryRun: true
            },
            CACHE_LAYER_URLS.urls
        );

        let sumOfIncentivizedValue = 0;
        const totalValue = await loan.getTotalValue();
        const debt = await loan.getDebt();
        const collateral = totalValue - debt;

        let rewards = {};
        for (const pool of pools) {
            let totalLpBalance = 0;
            console.log(`Calculating rewards for pool: ${pool}`);
            // const price = await loan.getPrice(toBytes32(pool));
            const price = 1;
            switch(pool) {
                case "WOMBAT_ggAVAX_AVAX_LP_AVAX":
                    totalLpBalance = await loan.avaxBalanceAvaxGgavaxYY();
                    break;
                case "WOMBAT_sAVAX_AVAX_LP_AVAX":
                    totalLpBalance = await loan.avaxBalanceAvaxSavaxYY();
                    break;
                case "WOMBAT_sAVAX_AVAX_LP_sAVAX":
                    totalLpBalance = await loan.sAvaxBalanceAvaxSavaxYY();
                    break;
                default:
                    break;
            }
            const incentivizedValue = totalLpBalance * price > collateral ? totalLpBalance * price - collateral : 0;
            sumOfIncentivizedValue += incentivizedValue;

            const rewardValueUSD = (APR * incentivizedValue * daysInWeek) / (daysInYear * PRECISION);
            rewards[pool] = {
                [loans[i]]: rewardValueUSD
            };
        }
        results.push(rewards);
        console.log("Processed", i, "PA accounts");
    }
    writeJSON("output.json", results);
    console.log("Rewards calculation completed.");
}

calculateRewards().catch(console.error);