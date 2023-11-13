import {
  LB_ROUTER_V21_ADDRESS, 
  LBRouterV21ABI
} from '@traderjoe-xyz/sdk-v2';
import * as traderJoeSdk from '@traderjoe-xyz/sdk-v2';
import { JSBI, ERC20ABI } from '@traderjoe-xyz/sdk';
import { Token, TokenAmount } from '@traderjoe-xyz/sdk-core';
import { ethers, BigNumber, utils } from 'ethers';
import axios from 'axios';
import config from '../config';

const CHAIN_ID = config.chainId;
const LBPairABI = [
  'function getReserves() public view returns (uint128, uint128)',
  'function getActiveId() public view returns (uint24)',
  'function balanceOf(address, uint256) public view returns (uint256)',
  'function getBin(uint24) public view returns (uint128, uint128)',
  'function totalSupply(uint256) public view returns (uint256)'
];

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

  async getLBPairReservesAndActiveBin(lbPairAddress, provider) {
    const lbPairContract = new ethers.Contract(lbPairAddress, LBPairABI, provider);
    const res = await Promise.all([
      lbPairContract.getReserves(),
      lbPairContract.getActiveId()
    ]);

    return res;
  }

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
    binRange,
    userPriceSlippage,
    userAmountsSlippage
  ) {
    // wrap into TokenAmount
    const tokenXAmount = new TokenAmount(tokenX, JSBI.BigInt(tokenXValue));
    const tokenYAmount = new TokenAmount(tokenY, JSBI.BigInt(tokenYValue));

    const allowedAmountsSlippage = userAmountsSlippage * 100;
    const minTokenXAmount =  JSBI.divide(
      JSBI.multiply(tokenXAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
      JSBI.BigInt(10000)
    );
    const minTokenYAmount =  JSBI.divide(
      JSBI.multiply(tokenYAmount.raw, JSBI.BigInt(10000 - allowedAmountsSlippage)),
      JSBI.BigInt(10000)
    );

    const allowedPriceSlippage = userPriceSlippage * 100;
    const priceSlippage = allowedPriceSlippage / 10000; // 0.005

    // set deadline for the transaction
    const currenTimeInSec = Math.floor((new Date().getTime()) / 1000);
    const deadline = currenTimeInSec + 3600;

    const idSlippage = this.getIdSlippageFromPriceSlippage(
      priceSlippage,
      Number(binStep)
    );

    // getting distribution parameters for selected shape given a price range
    let { deltaIds, distributionX, distributionY } = traderJoeSdk[distributionMethod](
      activeBinId,
      binRange,
      [tokenXAmount, tokenYAmount]
    );

    let number =  ((BigInt(distributionX[0])) > 0) ? BigInt(distributionX[0]) - BigInt(10) : BigInt(0);

    distributionX = distributionX.map(el => ((BigInt(el)) > BigInt(10)) ? BigInt(el) - BigInt(10) : BigInt(el))
    distributionY = distributionY.map(el => ((BigInt(el)) > BigInt(10)) ? BigInt(el) - BigInt(10) : BigInt(el))


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
      const routerContract = new ethers.Contract(
        LB_ROUTER_V21_ADDRESS[CHAIN_ID],
        LBRouterV21ABI,
        provider.getSigner()
      );

      const estimate = routerContract.estimateGas.addLiquidity // 'addLiquidityAVAX' if one of the tokens is AVAX
      const method = routerContract.addLiquidity

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

  async getRemoveLiquidityParameters(
    smartLoanAddress,
    lbPairAddress,
    provider,
    tokenX,
    tokenY,
    binStep,
    allowedAmountsSlippage,
    binIdsToRemove
  ) {
    const lbPairContract = new ethers.Contract(lbPairAddress, LBPairABI, provider);
    const amounts = [];
    const ids = [];
    let totalXBalanceWithdrawn = BigNumber.from(0);
    let totalYBalanceWithdrawn = BigNumber.from(0);

    for (let binId of binIdsToRemove) {
      const [lbTokenAmount, binReserves, totalSupply] = await Promise.all([
        lbPairContract.balanceOf(smartLoanAddress, binId),
        lbPairContract.getBin(binId),
        lbPairContract.totalSupply(binId)
      ]);

      if (lbTokenAmount != BigInt(0)) {
        ids.push(binId);
        amounts.push(lbTokenAmount);

        totalXBalanceWithdrawn = totalXBalanceWithdrawn
            .add(BigNumber.from(lbTokenAmount)
                .mul(BigNumber.from(binReserves[0]))
                .div(BigNumber.from(totalSupply))
            );
        totalYBalanceWithdrawn = totalYBalanceWithdrawn
            .add(BigNumber.from(lbTokenAmount)
                .mul(BigNumber.from(binReserves[1]))
                .div(BigNumber.from(totalSupply))
            );
      }
    }

    // To-do: set the dynamic amount slippage tolerance. for now we set it to 0.5%
    console.log('allowedAmountsSlippage: ', allowedAmountsSlippage)
    const minTokenXAmount = totalXBalanceWithdrawn
      .mul(BigNumber.from(10000 - allowedAmountsSlippage))
      .div(BigNumber.from(10000));
    const minTokenYAmount = totalYBalanceWithdrawn
      .mul(BigNumber.from(10000 - allowedAmountsSlippage))
      .div(BigNumber.from(10000));

    // set transaction deadline
    const currenTimeInSec =  Math.floor((new Date().getTime()) / 1000);
    const deadline = currenTimeInSec + 3600;

    // set array of remove liquidity parameters
    const removeLiquidityParams = [
      tokenX.address,
      tokenY.address,
      binStep,
      minTokenXAmount.toString(),
      minTokenYAmount.toString(),
      ids,
      amounts,
      smartLoanAddress,
      deadline
    ];

    return removeLiquidityParams;
  }

  async getRewardsInfo(loan, market, token) {
    try {
      const URL = `https://uophm6e26f.execute-api.us-east-1.amazonaws.com/traderjoe/rewards/claimable?chain=${window.chain}&loan=${loan}&market=${market}&token=${token}`;
      // const rewardsInfo = await axios.get(URL);
      const rewardsInfo = {"rewards":[{"epoch":6,"claimableRewards":[]},{"epoch":7,"claimableRewards":[{"amount":"316953165140564164157","tokenAddress":"0x371c7ec6d8039ff7933a2aa28eb827ffe1f52f07"}]}],"proofs":[["0x6de7ff6494772072f09f080d2c1e3d18eb875ba89055f2a2adfa3b8823f3f1d8","0x2737a2683556db1ee97a49fe8f3d035b7022397f85d4910fc19d9ab80564be2e","0x19be568450a1ab2f96893564328fbbe35cd1ae692aaf6fe20016bfb2a8deb668","0xb8a2f0ce201368a0f5d2b257a65ad6ac1b2d6d2069016c8ec4b85e7b374b8148","0x8fbb16092944116c0a20ec465d4d88ad7d2238afe6ed71c54abf175700ef1c14"],["0x65867fd4b5da30c5e0b4cea35c2e87204736cb341b956a2c6e07f4c35e53e8a8","0x6a692abbaef3880c2a78aa124fe578dff69d21ecd975c8e1194611586c89aead","0x1cced47c48a154a03b6d0c133a3c8867e1613f7de5a5bb8a3b6b8ccde52604cd","0xb174b605971169619292194e9ad7ddafe9e88f47065b5c214ddb92fcbc32462f","0x5934b700de5824088958539a83fc6b948a01952452738505431dd3d73a424e75"]]};
      console.log(rewardsInfo);

      return rewardsInfo;
    } catch (error) {
      console.log(`fetching rewards info failed. ${error}`);
    }
  }
}