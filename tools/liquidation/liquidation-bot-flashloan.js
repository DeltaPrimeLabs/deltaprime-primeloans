import TOKEN_MANAGER from '../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import IYieldYak from '../../artifacts/contracts/interfaces/facets/avalanche/IYieldYak.sol/IYieldYak.json';
import LIQUIDATION_FLASHLOAN from '../../artifacts/contracts/LiquidationFlashloan.sol/LiquidationFlashloan.json';
import addresses from '../../common/addresses/avax/token_addresses.json';
import TOKEN_ADDRESSES from '../../common/addresses/avax/token_addresses.json';
import {
    fromBytes32,
    getLiquidationAmounts,
    getLiquidationAmountsBasedOnLtv,
    StakedPosition, toBytes32,
    toWei
} from "../../test/_helpers";
import {ethers} from 'hardhat'
import redstone from "redstone-api";
import {
    getERC20Contract,
    getLiquidatorSigner, getProvider,
    getSignedDataPackagesResponse,
    wrapContractProd,
    wrapLoan
} from "./utlis";
import {ERC20} from "../../typechain";

const args = require('yargs').argv;
const network = args.network ? args.network : 'localhost';
const {fromWei, formatUnits} = require("../../test/_helpers");
const {parseUnits} = require("ethers/lib/utils");

const protocol = require("redstone-protocol");

let liquidator_wallet = getLiquidatorSigner(network);
let provider = getProvider(network);


function getTokenManager(tokenManagerAddress) {
    return new ethers.Contract(tokenManagerAddress, TOKEN_MANAGER.abi, liquidator_wallet);
}


export async function liquidateLoan(loanAddress, flashLoanAddress, tokenManagerAddress, ltvBasedCalculation = false) {
    let loan = await wrapLoan(loanAddress, liquidator_wallet);
    let tokenManager = getTokenManager(tokenManagerAddress);
    let poolTokens = await tokenManager.getAllPoolAssets();
    let poolTokenAddresses = await Promise.all(poolTokens.map(el => tokenManager.getAssetAddress(el, true)));
    let maxBonus = (await loan.getMaxLiquidationBonus()).toNumber() / 1000;


    //TODO: optimize to unstake only as much as needed
    for (let p of await loan.getStakedPositions()) {
        let stakedPosition = new StakedPosition(p[0], fromBytes32(p[1]), fromBytes32(p[2]), p[3], p[4]);

        let balanceMethod = loan.interface.getFunction(stakedPosition.balanceSelector);
        let unstakeMethod = loan.interface.getFunction(stakedPosition.unstakeSelector);

        await loan[unstakeMethod.name](await loan[balanceMethod.name](), toWei("0"));
    }

    // Unstake YieldYak positions

    let contract = new ethers.Contract(TOKEN_ADDRESSES.YY_AAVE_AVAX, IYieldYak.abi, liquidator_wallet);
    let balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakeAVAXYak(balance);
    }

    contract = new ethers.Contract(TOKEN_ADDRESSES.YY_PTP_sAVAX, IYieldYak.abi, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakeSAVAXYak(balance);
    }

    contract = new ethers.Contract(TOKEN_ADDRESSES.YY_PNG_AVAX_USDC_LP, IYieldYak.abi, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakePNGAVAXUSDCYak(balance);
    }

    contract = new ethers.Contract(TOKEN_ADDRESSES.YY_PNG_AVAX_ETH_LP, IYieldYak.abi, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakePNGAVAXETHYak(balance);
    }

    contract = new ethers.Contract(TOKEN_ADDRESSES.YY_TJ_AVAX_USDC_LP, IYieldYak.abi, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakeTJAVAXUSDCYak(balance);
    }

    contract = new ethers.Contract(TOKEN_ADDRESSES.YY_TJ_AVAX_ETH_LP, IYieldYak.abi, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakeTJAVAXETHYak(balance);
    }

    contract = new ethers.Contract(TOKEN_ADDRESSES.YY_TJ_AVAX_sAVAX_LP, IYieldYak.abi, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    if(fromWei(balance) !== 0){
        await loan.unstakeTJAVAXSAVAXYak(balance);
    }

    // Unwind LP positions

    // PNG_AVAX_USDC_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.PNG_AVAX_USDC_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    let decimals = await contract.decimals();
    if(formatUnits(balance, decimals)){
        await loan.removeLiquidityPangolin(toBytes32("AVAX"), toBytes32("USDC"), balance, 1, 1)
    }

    // PNG_AVAX_USDT_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.PNG_AVAX_USDT_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityPangolin(toBytes32("AVAX"), toBytes32("USDT"), balance, 1, 1)
    }

    // PNG_AVAX_ETH_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.PNG_AVAX_ETH_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityPangolin(toBytes32("AVAX"), toBytes32("ETH"), balance, 1, 1)
    }

    // TJ_AVAX_USDC_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_USDC_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("USDC"), balance, 1, 1)
    }

    // TJ_AVAX_USDT_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_USDT_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("USDT"), balance, 1, 1)
    }

    // TJ_AVAX_ETH_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_ETH_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("ETH"), balance, 1, 1)
    }

    // TJ_AVAX_BTC_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_BTC_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("BTC"), balance, 1, 1)
    }

    // TJ_AVAX_sAVAX_LP
    contract = await getERC20Contract(TOKEN_ADDRESSES.TJ_AVAX_sAVAX_LP, liquidator_wallet);
    balance = await contract.balanceOf(loan.address);
    decimals = await contract.decimals();
    if(formatUnits(balance, decimals)) {
        await loan.removeLiquidityTraderJoe(toBytes32("AVAX"), toBytes32("sAVAX"), balance, 1, 1)
    }


    let pricesArg = {}
    for (const asset of await tokenManager.getAllPoolAssets()) {
        pricesArg[fromBytes32(asset)] = (await redstone.getPrice(fromBytes32(asset), {provider: "redstone-avalanche-prod-node-3"})).value;
    }

    // const bonus = Math.abs(fromWei(await loan.getTotalValue()) - fromWei(await loan.getDebt())) < 0.1 ? 0 : maxBonus;
    //TODO: calculate in the future - it's needed for the flashloan fees
    const bonus = 0.01;

    const weiDebts = (await loan.getDebts());

    const debts = [];
    for (let debt of weiDebts) {
        let symbol = fromBytes32(debt.name);
        debts.push(
            {
                name: symbol,
                debt: formatUnits(debt.debt, await getERC20Contract(TOKEN_ADDRESSES[symbol], liquidator_wallet).decimals())
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
                balance: formatUnits(balance.balance, await getERC20Contract(TOKEN_ADDRESSES[symbol], liquidator_wallet).decimals())
            });
    }

    let loanIsBankrupt = fromWei(await loan.getTotalValue()) < fromWei(await loan.getDebt());

    let prices = (await loan.getAllAssetsPrices()).map(el => {
        return {
            dataFeedId: fromBytes32(el.name),
            value: formatUnits(el.price, 8)
        }
    });

    let {repayAmounts, deliveredAmounts} = ltvBasedCalculation ?
     getLiquidationAmountsBasedOnLtv(
        'LIQUIDATE',
        debts,
        balances,
        prices,
        4.1,
        bonus,
        loanIsBankrupt
    )
    :
    getLiquidationAmounts(
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
        let tokenContract = await getERC20Contract(addresses[repayment.name], liquidator_wallet);
        let decimals = await contract.decimals();
        amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
    }

    for (const allowance of deliveredAmounts) {
        let tokenContract = await getERC20Contract(addresses[allowance.name], liquidator_wallet);
        let decimals = await contract.decimals();
        let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
        await tokenContract.connect(liquidator_wallet).approve(loan.address, delivered);
    }

    const bonusInWei = (bonus * 1000).toFixed(0);

    let flashLoan = wrapContractProd(new ethers.Contract(flashLoanAddress, LIQUIDATION_FLASHLOAN.abi, liquidator_wallet));

    const parseDataPackagesResponse = (
        dataPackagesResponse
    ) => {
        const signedDataPackages = [];
        for (const dpForDataFeed of Object.values(dataPackagesResponse)) {
            signedDataPackages.push(...dpForDataFeed);
        }
        return signedDataPackages;
    };

    const signedDataPackagesResponse = await getSignedDataPackagesResponse();

    const signedDataPackages = parseDataPackagesResponse(signedDataPackagesResponse);
    const unsignedMetadata = "manual-payload";
    const redstonePayload = protocol.RedstonePayload.prepare(
        signedDataPackages, unsignedMetadata);

    try {
        const flashLoanTx = await flashLoan.executeFlashloan(
            {
                assets: poolTokenAddresses,
                amounts: amountsToRepayInWei,
                interestRateModes: new Array(poolTokenAddresses.length).fill(0),
                params: '0x' + redstonePayload,
                bonus: bonusInWei,
                liquidator: liquidator_wallet.address,
                loanAddress: loanAddress,
                tokenManager: tokenManager.address
            }, {
                gasLimit: 8_000_000
            }
        );

        console.log("Waiting for flashLoanTx: " + flashLoanTx.hash);
        let receipt = await provider.waitForTransaction(flashLoanTx.hash);
        console.log("Sellout processed with " + (receipt.status == 1 ? "success" : "failure"));
    } catch (error) {
        console.log(error)
    }
}
