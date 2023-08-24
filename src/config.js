export default {
    TRADERJOEV2_LP_ASSETS_CONFIG: {
        'TJ_AVAX-USDC': { primary: 'AVAX', secondary: 'USDC', name: 'AVAX-USDC', dex: 'TraderJoe', symbol: 'TJ_AVAX-USDC', decimals: 18, baseFee: '0.002', address: addresses['TJLB_AVAX-USDC'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
        'TJ_ETH-AVAX': { primary: 'ETH', secondary: 'AVAX', name: 'ETH-AVAX', dex: 'TraderJoe', symbol: 'TJ_ETH-AVAX', decimals: 18, baseFee: '0.001', address: addresses['TJLB_ETH-AVAX'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
    },
    liquidityShapes: {
        spot: {
            name: "Spot",
            imgSrc: "src/assets/icons/liquidity_shape_spot_on.svg",
            distributionMethod: "getUniformDistributionFromBinRange"
        },
        curve: {
            name: "Curve",
            imgSrc: "src/assets/icons/liquidity_shape_curve_on.svg",
            distributionMethod: "getCurveDistributionFromBinRange"
        },
        bidAsk: {
            name: "Bid-Ask",
            imgSrc: "src/assets/icons/liquidity_shape_bid-ask_on.svg",
            distributionMethod: "getBidAskDistributionFromBinRange"
        },
    }
}
