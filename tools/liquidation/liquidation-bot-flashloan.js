import TOKEN_MANAGER from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import LIQUIDATION_FLASHLOAN from '../../artifacts/contracts/LiquidationFlashloan.sol/LiquidationFlashloan.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import {fromBytes32, getLiquidationAmounts, StakedPosition, toWei} from "../../test/_helpers";
import {ethers} from 'hardhat'
import redstone from "redstone-api";
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {expect} from "chai";
const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const interval = args.interval ? args.interval : 10;
const minutesSync = args.minutesSync ? args.minutesSync : 0;
const {getUrlForNetwork} = require("../scripts/helpers");
const {WrapperBuilder} = require("@redstone-finance/evm-connector");
const fs = require('fs');
const {fromWei, formatUnits} = require("../../test/_helpers");
const {parseUnits} = require("ethers/lib/utils");
const path = require("path");
const protocol = require("redstone-protocol");
const sdk = require("redstone-sdk");

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]

const PRIVATE_KEY =  fs.readFileSync(path.resolve(__dirname, "./.private")).toString().trim();
const RPC_URL = getUrlForNetwork(network);

let provider = new ethers.providers.JsonRpcProvider(RPC_URL)
let wallet = (new ethers.Wallet(PRIVATE_KEY)).connect(provider);


async function wrapLoan(loanAddress) {
    let loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loanAddress, wallet);

    loan = WrapperBuilder.wrap(loan).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "LINK"],
        },
        [
            "https://cache-service-direct-1.a.redstone.finance",
            "https://cache-service-direct-2.a.redstone.finance",
            "https://cache-service-streamr-1.a.redstone.finance",
        ]
    );

    return loan
}

function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, wallet);
}

export async function liquidateLoan(loanAddress, flashLoanAddress, tokenManagerAddress, diamondAddress, diamondOwner) {
    let loan = await wrapLoan(loanAddress);
    let tokenManager = getTokenManager(tokenManagerAddress);
    let poolTokens = await tokenManager.getAllPoolAssets();
    let poolTokenAddresses = await Promise.all(poolTokens.map(el => tokenManager.getAssetAddress(el, true)));
    let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;

    //TODO: calculate bonus
    // const bonus = calculateBonus(
    //     'LIQUIDATE',
    //     fromWei(await loan.getDebt()),
    //     fromWei(await loan.getTotalValue()),
    //     4.1,
    //     maxBonus
    // );

    //TODO: optimize to unstake only as much as needed
    for (let p of await loan.getStakedPositions()) {
        let stakedPosition = new StakedPosition(p[0], fromBytes32(p[1]), p[2], p[3]);

        let balanceMethod = loan.interface.getFunction(stakedPosition.balanceSelector);
        let unstakeMethod = loan.interface.getFunction(stakedPosition.unstakeSelector);

        await loan[unstakeMethod.name](await loan[balanceMethod.name](), toWei("0"));
    }

    let pricesArg = {}
    for (const asset of await tokenManager.getAllPoolAssets()) {
        pricesArg[fromBytes32(asset)] = (await redstone.getPrice(fromBytes32(asset), {provider: "redstone-avalanche-prod-node-3"})).value;
    }

    const bonus = Math.abs(fromWei(await loan.getTotalValue()) - fromWei(await loan.getDebt())) < 0.1 ? 0 : maxBonus;

    const weiDebts = (await loan.getDebts());

    const debts = [];
    for (let debt of weiDebts) {
        let symbol = fromBytes32(debt.name);
        debts.push(
            {
                name: symbol,
                debt: formatUnits(debt.debt, await getTokenContract(TOKEN_ADDRESSES[symbol]).decimals())
        });
    }

    const balances = [];

    const weiBalances = (await loan.getAllAssetsBalances());
    for (let balance of weiBalances) {
        let symbol = fromBytes32(balance.name);

        balances.push(
            {
                name: symbol,
                //@ts-ignore
                debtCoverage: fromWei(await tokenManager.debtCoverage(TOKEN_ADDRESSES[symbol])),
                balance: formatUnits(balance.balance, await getTokenContract(TOKEN_ADDRESSES[symbol]).decimals())
        });
    }

    let loanIsBankrupt = await loan.getTotalValue() < await loan.getDebt();

    let prices = (await loan.getAllAssetsPrices()).map(el => {
        return {
            dataFeedId: fromBytes32(el.name),
            value: formatUnits(el.price, 8)
        }
    });

    let {repayAmounts, deliveredAmounts} = getLiquidationAmounts(
        'LIQUIDATE',
        debts,
        balances,
        prices,
        1.04,
        bonus,
        loanIsBankrupt
    );

    let amountsToRepayInWei = [];

    for (const repayment of repayAmounts) {
        let tokenContract = await getTokenContract(addresses[repayment.name]);
        let decimals = await tokenContract.decimals();
        amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
    }

    for (const allowance of deliveredAmounts) {
        let tokenContract = await getTokenContract(addresses[allowance.name]);
        let decimals = await tokenContract.decimals();
        let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
        await tokenContract.connect(wallet).approve(loan.address, delivered);
    }

    const bonusInWei = (bonus * 1000).toFixed(0);

    let flashLoan = new ethers.Contract(flashLoanAddress, LIQUIDATION_FLASHLOAN.abi, wallet);

    flashLoan = WrapperBuilder.wrap(flashLoan).usingDataService(
        {
            dataServiceId: "redstone-avalanche-prod",
            uniqueSignersCount: 3,
            dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "LINK"],
        },
        [
            "https://cache-service-direct-1.a.redstone.finance",
            "https://cache-service-direct-2.a.redstone.finance",
            "https://cache-service-streamr-1.a.redstone.finance",
        ]
    );

    const parseDataPackagesResponse = (
        dataPackagesResponse
    ) => {
        const signedDataPackages = [];
        for (const dpForDataFeed of Object.values(dataPackagesResponse)) {
            signedDataPackages.push(...dpForDataFeed);
        }
        return signedDataPackages;
    };

    const signedDataPackagesResponse = await sdk.requestDataPackages({
        dataServiceId: "redstone-avalanche-prod",
        uniqueSignersCount: 3,
        dataFeeds: ["AVAX", "ETH", "USDC", "BTC", "LINK"],
    },  [
        "https://cache-service-direct-1.a.redstone.finance",
        "https://cache-service-direct-2.a.redstone.finance",
        "https://cache-service-streamr-1.a.redstone.finance",
    ]
    );

    const signedDataPackages = parseDataPackagesResponse(signedDataPackagesResponse);
    const unsignedMetadata = "manual-payload";
    const redstonePayload = protocol.RedstonePayload.prepare(
        signedDataPackages, unsignedMetadata);

    let liquidatorsList = await ethers.getContractAt('ISmartLoanLiquidationFacet', diamondAddress, diamondOwner);
    await liquidatorsList.whitelistLiquidators([flashLoanAddress]);
    expect(await liquidatorsList.isLiquidatorWhitelisted(flashLoanAddress)).to.be.true;


    const flashLoanTx = await flashLoan.executeFlashloan(
    {
        assets: poolTokenAddresses,
        amounts: amountsToRepayInWei,
        interestRateModes: new Array(poolTokenAddresses.length).fill(0), 
        params: '0x' + redstonePayload,
        bonus: bonusInWei,
        liquidator: wallet.address,
        loanAddress: loanAddress,
        tokenManager: tokenManager.address
    }, {
        gasLimit: 100_000_000_000
      }
    );

    console.log("Waiting for flashLoanTx: " + flashLoanTx.hash);
    let receipt = await provider.waitForTransaction(flashLoanTx.hash);
    console.log("Sellout processed with " + (receipt.status == 1 ? "success" : "failure"));
}

function getTokenContract(address) {
    return new ethers.Contract(address, erc20ABI, wallet);
}

console.log(`Started liquidation bot for network: ${network} (${RPC_URL}) and interval ${interval}. Minutes sync: ${minutesSync}`);
