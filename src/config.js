import addresses from '../common/addresses/avax/token_addresses.json';

export default {
    DEFAULT_LTV: 2,
    MAX_COLLATERAL: 500,
    MAX_ALLOWED_LTV: 4.5,
    LIQUIDATION_LTV: 5,
    COMPETITION_START_BLOCK: 14858534,
    chainId: 1337,
    ASSETS_CONFIG: {
      "AVAX": {name: "AVAX", symbol: "AVAX", decimals: 18},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true},
      "BTC": {name: "Bitcoin", symbol: "BTC", decimals: 8, address: addresses.BTC},
      "ETH": {name: "Ether", symbol: "ETH", decimals: 18, address: addresses.ETH},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true},
      "PNG": {name: "Pangolin", symbol: "PNG", decimals: 18, address: addresses.PNG},
      "XAVA": {name: "Avalaunch", symbol: "XAVA", decimals: 18, address: addresses.XAVA, logoExt: "png"},
      "LINK": {name: "Link", symbol: "LINK", decimals: 18, address: addresses.LINK},
      "YAK": {name: "Yak", symbol: "YAK", decimals: 18, address: addresses.YAK},
      "QI": {name: "BENQI", symbol: "QI", decimals: 18, address: addresses.QI},
    },
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/delta-prime"
}
