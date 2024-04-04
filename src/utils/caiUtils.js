import {BigNumber, constants, utils} from 'ethers';
import {ZeroExAggregator} from '@phuture/sdk';
import {BaseIndex__factory} from '@phuture/index/src/types';
import {IndexRouter__factory} from '@phuture/index-router/src/types';
export const PhuturePriceOracleAbi = require('../../test/abis/PhuturePriceOracle.json');
export const PhutureIndexAbi = require('../../test/abis/PhutureIndex.json');
export const PhutureIndexRouterAbi = require('../../test/abis/PhutureIndexRouter.json');
const ethers = require('ethers');

export const splitCallData = (calldata) => {
  const selector = calldata.slice(0, 10);
  const data = "0x" + calldata.slice(10);
  return {
    selector,
    data
  };
};


async function getBuyAmounts(amounts, inputToken) {
  /// Prepare buy amounts for each asset
  const buyAmounts = amounts.map(async ({ asset, amount }) => {
    /// If the asset is the input token or the amount is zero, return the asset and amount
    if (asset.toLowerCase() === inputToken.toLowerCase() || amount.isZero()) {
      console.log('asset is input token or amount is zero');
      return {
        asset,
        swapTarget: constants.AddressZero,
        buyAssetMinAmount: amount,
        assetQuote: [],
      }
    }

    const [zeroExAggregator] = ZeroExAggregator.fromUrl(
      "https://avalanche.api.0x.org",
      43314,
      '6e843079-8fe1-4f5f-ab54-835dd1bd7639'
    );

    /// Otherwise, get the buy amount from the 0x Aggregator
    console.log('get buy amounts');
    console.log('inputToken', inputToken);
    console.log('asset', asset);
    console.log('amount', amount);

    const zeroExResult = await zeroExAggregator.quote(inputToken, asset, amount)

    return {
      asset,
      swapTarget: zeroExResult.to,
      buyAssetMinAmount: BigNumber.from(zeroExResult.buyAmount).mul(99).div(100).toString(),
      assetQuote: zeroExResult.data,
    }
  })

  /// Use `Promise.all` to resolve all buy amounts concurrently
  return await Promise.all(buyAmounts)
}

async function calculateBuyAmountsInBase(buyAmounts, amounts) {
  const priceOracle = new ethers.Contract(
    "0x69E848b2F41019340CeC3e6696D5c937e74Da96b",
    PhuturePriceOracleAbi,
    provider,
  );

  /// Calculate the buy amounts in base currency
  const buyAmountsInBase = buyAmounts.map(
    async ({ asset, buyAssetMinAmount }, amountIndex) => {
      /// Get the price of the asset in base currency from the PriceOracle
      /// Note: `callStatic` is used because this is not a view function
      const price = await priceOracle.callStatic.refreshedAssetPerBaseInUQ(
        asset,
      )

      /// Calculate the quoted buy amount in base currency
      const quotedBuyAmount = BigNumber.from(buyAssetMinAmount)
        .mul(BigNumber.from(2).pow(112))
        .mul(255)
        .div(price.mul(amounts[amountIndex].weight))

      return { asset, quotedBuyAmount }
    },
  )

  /// Use `Promise.all` to resolve all buy amounts in base currency concurrently
  return await Promise.all(buyAmountsInBase)
}

async function getMintQuotes(amounts, inputToken, scaledSellAmounts) {
  /// Prepare quotes for each asset
  const quotes = amounts.map(async ({ asset }, i) => {
    const scaledSellAmount = scaledSellAmounts[i]

    /// If the asset is the input token or the scaled sell amount is zero, return the asset and amount
    if (asset.toLowerCase() === inputToken.toLowerCase() || scaledSellAmount.isZero()) {
      return {
        asset,
        swapTarget: constants.AddressZero,
        buyAssetMinAmount: scaledSellAmounts[i],
        assetQuote: [],
    }
    }

    const [zeroExAggregator] = ZeroExAggregator.fromUrl(
      "https://avalanche.api.0x.org",
      43314,
      '6e843079-8fe1-4f5f-ab54-835dd1bd7639'
    );

    /// Otherwise, get the quote from the 0x Aggregator
    const zeroExResult = await zeroExAggregator.quote(
      inputToken,
      asset,
      scaledSellAmount,
    )

    return {
      asset,
      buyAssetMinAmount: BigNumber.from(zeroExResult.buyAmount).mul(99).div(100),
      swapTarget: zeroExResult.to,
      assetQuote: zeroExResult.data,
    }
  })

  /// Use `Promise.all` to resolve all quotes concurrently
  return await Promise.all(quotes)
}

async function prepareMintQuotes(inputToken, amountIn) {
  const index = new ethers.Contract(
    "0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0",
    PhutureIndexAbi,
    provider,
  );

  /// Retrieve the current index anatomy and inactive anatomy from the index contract
  const { _assets, _weights } = await index.anatomy()

  console.log('anatomy', _assets, _weights);

  /// Prepare amounts for each asset
  let amounts = _assets.map((asset, i) => ({
    asset,
    amount: BigNumber.from(amountIn).mul(_weights[i]).div(255),
    weight: _weights[i],
  }))

  console.log('prepare mint quotes', inputToken, amountIn);
  console.log('amounts', amounts);

  // amounts = amounts.filter(amount => amount.asset.toLowerCase() !== inputToken.toLowerCase());

  console.log('amounts after filter', amounts);

  /// Get the buy amounts for the given amounts and input token
  const buyAmounts = await getBuyAmounts(amounts, inputToken)

  /// Calculate the buy amounts in base currency
  const buyAmountsInBase = await calculateBuyAmountsInBase(buyAmounts, amounts)

  /// Find the minimum buy amount in base currency
  const minBuyAmount = buyAmountsInBase.reduce((min, curr) =>
    min.quotedBuyAmount.lte(curr.quotedBuyAmount) ? min : curr,
  )

  /// Scale the sell amounts based on the minimum buy amount
  const scaledSellAmounts = Object.values(amounts).map(({ amount }, i) =>
    amount
      .mul(minBuyAmount.quotedBuyAmount)
      .div(buyAmountsInBase[i].quotedBuyAmount),
  )

  /// Get quotes for the given amounts, input token, and scaled sell amounts
  const quotes = await getMintQuotes(amounts, inputToken, scaledSellAmounts)

  /// Calculate the total sell amount
  const sellAmount = scaledSellAmounts.reduce(
    (sum, curr) => sum.add(curr),
    BigNumber.from(0),
  )

  return { quotes, sellAmount }
}

export async function getMintData(inputToken, amountIn, recipient) {
  console.log('get mint data', inputToken);
  /// Prepare quotes for minting tokens and get the scaled total sell amount
  const { quotes, sellAmount } = await prepareMintQuotes(inputToken, amountIn)

  const indexRouter = new ethers.Contract("0xD6dd95610fC3A3579a2C32fe06158d8bfB8F4eE9", PhutureIndexRouterAbi, provider)

  // Use `.mintSwapValue` if you want to use native currency as input
  const mintTx = await indexRouter.populateTransaction.mintSwap({
    index: "0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0",
    inputToken: inputToken,
    recipient,
    amountInInputToken: sellAmount,
    quotes,
  });

  return splitCallData(mintTx.data);
}

async function prepareBurnQuotes(shares, outputToken, recipient) {
  const BURN_SLIPPAGE = 0.03;
  const index = new ethers.Contract(
    "0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0",
    PhutureIndexAbi,
    provider,
  );
  const indexRouter = new ethers.Contract(
    "0xD6dd95610fC3A3579a2C32fe06158d8bfB8F4eE9",
    PhutureIndexRouterAbi,
    provider
  );

  /// Retrieve the current index anatomy and inactive anatomy from the index contract
  const [{ _assets, _weights }, inactiveAnatomy, burnTokensAmounts] =
    await Promise.all([
      index.anatomy(),
      index.inactiveAnatomy(),
      indexRouter.callStatic.burnWithAmounts(
        {
          index: index.address,
          recipient,
          amount: shares,
        },
        {
          from: recipient,
        },
      ),
    ])

  /// Merge the active and inactive anatomy into a single array
  const constituents = [
    ..._assets.map((asset, i) => ({ asset, weight: _weights[i] })),
    ...inactiveAnatomy.map((asset) => ({ asset, weight: 0 })),
  ]

  /// Prepare quotes for burning tokens
  const quotes = constituents.map(async ({ asset }, constituentIndex) => {
    const amount = burnTokensAmounts[constituentIndex] || BigNumber.from(0)
    /// If the amount is zero or the asset is the output token, return an empty quote
    if (!amount || amount.isZero() || asset.toLowerCase() === outputToken.toLowerCase()) {
      return {
        swapTarget: constants.AddressZero,
        assetQuote: [],
        buyAssetMinAmount: 0,
      }
    }

    const [zeroExAggregator] = ZeroExAggregator.fromUrl(
      "https://avalanche.api.0x.org",
      43314,
      '6e843079-8fe1-4f5f-ab54-835dd1bd7639'
    );
    /// Use the 0x Aggregator to get a quote for burning the token
    const zeroExResult = await zeroExAggregator.quote(
      asset,
      outputToken,
      amount.mul(98).div(100),
    )

    return {
      swapTarget: zeroExResult.to,
      buyAssetMinAmount: zeroExResult.buyAmount,
      assetQuote: zeroExResult.data,
    }
  })

  /// Use `Promise.all` to resolve all the quotes concurrently
  return await Promise.all(quotes)
}

async function prepareQuotes(shares, outputToken, recipientAddress) {
  const INDEX_ADDRESS = '0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0';
  const INDEX_ROUTER_ADDRESS = '0xD6dd95610fC3A3579a2C32fe06158d8bfB8F4eE9';
  const BALANCE_OF_SLOT = 8;
  const ALLOWANCE_SLOT = 9;
  const BURN_SLIPPAGE = 0.03;

  const index = BaseIndex__factory.connect(INDEX_ADDRESS, provider)
  const indexRouter = IndexRouter__factory.connect(INDEX_ROUTER_ADDRESS, provider)

  const [zeroExAggregator] = ZeroExAggregator.fromUrl(
    "https://avalanche.api.0x.org",
    43314,
    '6e843079-8fe1-4f5f-ab54-835dd1bd7639'
  );

  const balanceOfOwnerSlot = utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['address', 'uint256'],
      [recipientAddress, BALANCE_OF_SLOT],
    ),
  )

  const allowanceOwnerSlot = utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['address', 'uint256'],
      [recipientAddress, ALLOWANCE_SLOT],
    ),
  )
  const spenderSlot = utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['address', 'bytes32'],
      [INDEX_ROUTER_ADDRESS, allowanceOwnerSlot],
    ),
  )

  const stateDiff = {
    [INDEX_ADDRESS]: {
      stateDiff: {
        [balanceOfOwnerSlot]: utils.hexZeroPad(
          utils.hexValue(BigNumber.from(shares)),
          32,
        ),
        [spenderSlot]: utils.hexZeroPad(
          utils.hexValue(BigNumber.from(shares)),
          32,
        ),
      },
    },
  }

  /// Retrieve the current index anatomy and inactive anatomy from the index contract
  const [{ _assets, _weights }, inactiveAnatomy, rawBurnTokensAmounts] =
    await Promise.all([
      index.anatomy(),
      index.inactiveAnatomy(),
      provider.send('eth_call', [
        {
          from: recipientAddress,
          to: indexRouter.address,
          data: indexRouter.interface.encodeFunctionData('burnWithAmounts', [
            {
              index: index.address,
              recipient: recipientAddress,
              amount: shares,
            },
          ]),
        },
        'latest',
        stateDiff,
      ]),
    ])

  const [burnTokensAmounts] = new utils.AbiCoder().decode(
    ['uint[]'],
    rawBurnTokensAmounts,
  )

  console.log('Burn Tokens Amounts:')
  console.table(
    burnTokensAmounts.map((amount, i) => ({
      asset: _assets[i],
      amount: amount.toString(),
    })),
  )

  /// Merge the active and inactive anatomy into a single array
  const constituents = [
    ..._assets.map((asset, i) => ({ asset, weight: _weights[i] })),
    ...inactiveAnatomy.map((asset) => ({ asset, weight: 0 })),
  ]

  /// Prepare quotes for burning tokens
  const quotes = constituents.map(async ({ asset }, constituentIndex) => {
    const amount = burnTokensAmounts[constituentIndex] || BigNumber.from(0)
    /// If the amount is zero or the asset is the output token, return an empty quote
    if (!amount || amount.isZero() || asset.toLowerCase() === outputToken.toLowerCase()) {
      return {
        swapTarget: constants.AddressZero,
        assetQuote: [],
        buyAssetMinAmount: 0,
      }
    }

    zeroExAggregator.slippageProtection = true;
    /// Use the 0x Aggregator to get a quote for burning the token
    const zeroExResult = await zeroExAggregator.quote(
      asset,
      outputToken,
      amount.mul(999999).div(1000000),
      {
        slippagePercentage: 0.03,
      }
    )

    console.log('zeroExResult', zeroExResult);
    const buyAssetMinAmount =  BigNumber.from(zeroExResult.buyAmount)
      .mul(1000 - BURN_SLIPPAGE * 1000)
      .div(1000);
    console.log('buyAssetMinAmount', buyAssetMinAmount);

    return {
      swapTarget: zeroExResult.to,
      buyAssetMinAmount: buyAssetMinAmount,
      assetQuote: zeroExResult.data,
    }
  })

  /// Use `Promise.all` to resolve all the quotes concurrently
  return await Promise.all(quotes)
}


export async function getBurnData(shares, outputToken, recipient) {
  console.log('get burn data');
  /// Prepare quotes for burning tokens
  const quotes = await prepareQuotes(shares, outputToken, recipient);

  const indexRouter = new ethers.Contract("0xD6dd95610fC3A3579a2C32fe06158d8bfB8F4eE9", PhutureIndexRouterAbi, provider);

  // Use `.burnSwapValue` if you want to use native currency as output
  const burnTx =  await indexRouter.populateTransaction.burnSwap({
    index: "0x48f88A3fE843ccb0b5003e70B4192c1d7448bEf0",
    amount: shares,
    outputAsset: outputToken,
    recipient: recipient,
    quotes,
  });

  console.log(burnTx);

  return splitCallData(burnTx.data);
}
