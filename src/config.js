import addresses from '../common/token_addresses.json';

export default {
    DEFAULT_LTV: 2,
    MAX_LTV: 5,
    chainId: 43113,
    ASSETS_CONFIG: {
      "AVAX": {name: "AVAX", symbol: "AVAX", decimals: 18},
      "ETH": {name: "Ether", symbol: "ETH", decimals: 18, address: addresses.ETH},
      "BTC": {name: "Bitcoin", symbol: "BTC", decimals: 8, address: addresses.BTC},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 18, address: addresses.USDT}
    },
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod"
}
