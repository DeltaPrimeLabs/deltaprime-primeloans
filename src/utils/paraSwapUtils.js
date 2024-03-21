const ethers = require('ethers');
import {SwapSide} from '@paraswap/sdk';


export const paraSwapRouteToSimpleData = (txParams) => {
  console.log('paraSwapRouteToSimpleData');
  const data = '0x' + txParams.data.slice(10);
  console.log(data);
  const [
    decoded,
  ] = ethers.utils.defaultAbiCoder.decode(
    ['(address,address,uint256,uint256,uint256,address[],bytes,uint256[],uint256[],address,address,uint256,bytes,uint256,bytes16)'],
    data
  );
  console.log(decoded);
  return {
    fromToken: decoded[0],
    toToken: decoded[1],
    fromAmount: decoded[2],
    toAmount: decoded[3],
    expectedAmount: decoded[4],
    callees: decoded[5],
    exchangeData: decoded[6],
    startIndexes: decoded[7],
    values: decoded[8],
    beneficiary: decoded[9],
    partner: decoded[10],
    feePercent: decoded[11],
    permit: decoded[12],
    deadline: decoded[13],
    uuid: decoded[14],
  };
};

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
    simpleData: paraSwapRouteToSimpleData(txParams),
    routeData: parseParaSwapRouteData(txParams)
  };
};