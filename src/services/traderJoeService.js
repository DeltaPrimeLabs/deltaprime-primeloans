import { Subject } from 'rxjs';
import { 
  LB_ROUTER_V21_ADDRESS,
  LBRouterV21ABI,
  PairV2,
  RouteV2,
  TradeV2,
  Bin,
  LiquidityDistribution,
  getLiquidityConfig,
  getDistributionFromTargetBin,
  getUniformDistributionFromBinRange,
  getBidAskDistributionFromBinRange,
  getCurveDistributionFromBinRange
} from '@traderjoe-xyz/sdk-v2';
import * as traderJoeSdk from '@traderjoe-xyz/sdk-v2';
import { ERC20ABI, JSBI } from '@traderjoe-xyz/sdk';
import { ChainId, Token, TokenAmount, WNATIVE, CurrencyAmount } from '@traderjoe-xyz/sdk-core';
import { ethers, BigNumber, utils } from 'ethers';
import { MaxUint256 } from '@ethersproject/constants'
import config from '../config';

const CHAIN_ID = config.chainId;

export default class TraderJoeService {
  calculateGasMargin(value, margin = 1000) {
    return BigNumber.from(value)
      .mul(BigNumber.from(10000).add(BigNumber.from(margin)))
      .div(BigNumber.from(10000));
  }

  initializeToken(tokenData) {
    // initialize Token
    const token = new Token(
      CHAIN_ID,
      tokenData.address,
      tokenData.decimals,
      tokenData.symbol,
      tokenData.name
    );

    return token;
  }

  // To-do: fetchLBPair 3rd argument error. contact TJ team for updated doc or guide.
  // async getLBPairReservesAndActiveBin(tokenX, tokenY, binStep, provider) {
  //   const pair = new PairV2(tokenX, tokenY);
  //   const isV21 = true; // set to true if it's a V2.1 pair
  //   const lbPair = await pair.fetchLBPair(Number(binStep), isV21, PROVIDER, CHAIN_ID);
  //   const lbPairData = await PairV2.getLBPairReservesAndId(lbPair.LBPair, isV21, PROVIDER);

  //   return lbPairData;
  // }

  getIdSlippageFromPriceSlippage(priceSlippage, binStep) {
    return Math.floor(
      Math.log(1 + priceSlippage) / Math.log(1 + binStep / 1e4)
    );
  }

  getAddLiquidityParameters(
    address,
    tokenX,
    tokenY,
    tokenXValue,
    tokenYValue,
    distributionMethod,
    binStep,
    activeBinId,
    binRange
  ) {
    // wrap into TokenAmount
    const tokenXAmount = new TokenAmount(tokenX, JSBI.BigInt(tokenXValue));
    const tokenYAmount = new TokenAmount(tokenY, JSBI.BigInt(tokenYValue));

    // To-do: set the dynamic amount slippage tolerance. for now we set it to 0.5%
    const allowedAmountsSlippage = 50;
    const minTokenXAmount =  JSBI.divide(
      JSBI.multiply(tokenXAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
      JSBI.BigInt(10000)
    );
    const minTokenYAmount =  JSBI.divide(
      JSBI.multiply(tokenYAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
      JSBI.BigInt(10000)
    );

    // To-do: set the dynamic price slippage tolerance. for now we set it to 0.5%
    const allowedPriceSlippage = 50;
    const priceSlippage = allowedPriceSlippage / 10000; // 0.005

    // set deadline for the transaction
    const currenTimeInSec = Math.floor((new Date().getTime()) / 1000);
    const deadline = currenTimeInSec + 3600;

    const idSlippage = this.getIdSlippageFromPriceSlippage(
      priceSlippage,
      Number(binStep)
    );

    // getting distribution parameters for selected shape given a price range
    const { deltaIds, distributionX, distributionY } = traderJoeSdk[distributionMethod](
      activeBinId,
      binRange,
      [tokenXAmount, tokenYAmount]
    );

    // declare liquidity parameters
    const addLiquidityInput = {
      tokenX: tokenX.address,
      tokenY: tokenY.address,
      binStep: Number(binStep),
      amountX: tokenXAmount.raw.toString(),
      amountY: tokenYAmount.raw.toString(),
      amountXMin: minTokenXAmount.toString(),
      amountYMin: minTokenYAmount.toString(),
      activeIdDesired: activeBinId,
      idSlippage,
      deltaIds,
      distributionX,
      distributionY,
      to: address,
      refundTo: address,
      deadline 
    };

    return addLiquidityInput;
  }

  async approveLBRouter(tokenAddress, tokenAmount, account, provider) {
    const spender = LB_ROUTER_V21_ADDRESS[CHAIN_ID];
    const amount = BigNumber.from(tokenAmount);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider.getSigner());
    const allowance = utils.formatUnits(await tokenContract.allowance(account, spender));

    if (parseFloat(allowance) < parseFloat(utils.formatUnits(amount))) {
      const estimatedGas = await tokenContract.estimateGas.approve(spender, amount)
      const tx = await tokenContract.approve(
        spender, 
        amount, 
        { gasLimit: this.calculateGasMargin(estimatedGas) }
      )
      await tx.wait();
    }
  }

  async addLiquidity({ provider, addLiquidityInput }) {
    try{
      await this.approveLBRouter(addLiquidityInput.tokenX, addLiquidityInput.amountX, addLiquidityInput.to, provider);
      await this.approveLBRouter(addLiquidityInput.tokenY, addLiquidityInput.amountY, addLiquidityInput.to, provider);
      // init router contract
      const router = new ethers.Contract(
        LB_ROUTER_V21_ADDRESS[CHAIN_ID],
        LBRouterV21ABI,
        provider.getSigner()
      )

      // await router.addLiquidity(addLiquidityInput);

      const estimate = router.estimateGas.addLiquidity // 'addLiquidityAVAX' if one of the tokens is AVAX
      const method = router.addLiquidity

      // set AVAX amount, such as tokenAmountAVAX.raw.toString(), when one of the tokens is AVAX; otherwise, set to null
      const value = null 

      // call methods
      const estimatedGasLimit = await estimate(
        addLiquidityInput,
        value ? { value } : {}
      )

      await method(addLiquidityInput, {
        ...(value ? { value } : {}),
        gasLimit: this.calculateGasMargin(estimatedGasLimit)
      })
    } catch(error) {
      console.log(error);
    }
  }

  getRemoveLiquidityParameters() {
    
  }

  async removeLiquidity() {

  }
}