import {SwapSide} from '@paraswap/sdk';

export const parseParaSwapRouteData = (txParams) => {
  console.log('parseParaSwapRouteData');
  const selector = txParams.data.slice(0, 10);
  const data = "0x" + txParams.data.slice(10);
  return {
    selector,
    data
  };
};


export const getSwapData = async (paraSwapSDK, userAddress, srcTokenAddress, destTokenAddress, srcAmount, srcDecimals, destDecimals) => {
  console.log('getSwapData');
  const priceRoute = await paraSwapSDK.swap.getRate({
    srcToken: srcTokenAddress,
    destToken: destTokenAddress,
    amount: srcAmount.toString(),
    userAddress: userAddress,
    side: SwapSide.SELL,
    srcDecimals: srcDecimals,
    destDecimals: destDecimals
  });
  console.log(priceRoute);
  const txParams = await paraSwapSDK.swap.buildTx({
    srcToken: priceRoute.srcToken,
    destToken: priceRoute.destToken,
    srcAmount: priceRoute.srcAmount,
    destAmount: priceRoute.destAmount,
    priceRoute,
    userAddress: userAddress,
    partner: 'anon',
  }, {
    ignoreChecks: true,
  });
  console.log(txParams);
  return {
    simpleData: {
      destAmount: priceRoute.destAmount
    },
    routeData: parseParaSwapRouteData(txParams)
  };
};