import addresses from '../common/addresses/avax/token_addresses.json';
import {yyApy, yyStaked} from "./utils/calculate";

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
      "LINK": {name: "Link", symbol: "LINK", decimals: 18, address: addresses.LINK},
      "QI": {name: "BENQI", symbol: "QI", decimals: 18, address: addresses.QI},
      "SAVAX": {name: "sAVAX", symbol: "sAVAX", decimals: 18, address: addresses.sAVAX},
    },
    LP_ASSETS_CONFIG: {
        "PNG_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDC_LP', decimals: 18, address: addresses.PNG_AVAX_USDC_LP},
        "TJ_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDC_LP', decimals: 18, address: addresses.TJ_AVAX_USDC_LP},

    },
    DEX_CONFIG: {
        'Pangolin': {
            addLiquidityMethod: 'addLiquidityPangolin',
            removeLiquidityMethod: 'removeLiquidityPangolin'
        },
        'TraderJoe': {
            addLiquidityMethod: 'addLiquidityTraderJoe',
            removeLiquidityMethod: 'removeLiquidityTraderJoe'
        }
    },
    PROTOCOLS_CONFIG: {
        YIELD_YAK: {
            logo: 'yak.svg',
            name: 'Yield Yak'
        },
        VECTOR_FINANCE: {
            logo: 'vector.png',
            name: 'Vector Finance'
        },
    },
    FARMED_TOKENS_CONFIG: {
        AVAX: [
            {
                protocol: 'YIELD_YAK',
                apy: async () => yyApy('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95'),
                staked: async (address) => yyStaked('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakeMethod: 'stakeAVAXYak',
                unstakeMethod: 'unstakeAVAXYak',
            },
            {
                protocol: 'VECTOR_FINANCE',
                apy: async () => yyApy('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95'),
                staked: async (address) => yyStaked('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakeMethod: 'vectorStakeWAVAX1',
                unstakeMethod: 'vectorUnstakeWAVAX1',
            }
        ],
        SAVAX: [
            {
                protocol: 'VECTOR_FINANCE',
                apy: () => yyApy('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95'),
                staked: (address) => yyStaked('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakeMethod: 'vectorStakeSAVAX1',
                unstakeMethod: 'vectorUnstakeSAVAX1'
            },
            {
                protocol: 'YIELD_YAK',
                apy: async () => yyApy('0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557'),
                staked: async (address) => yyStaked('0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557', address),
                stakeMethod: 'stakeSAVAXYak',
                unstakeMethod: 'unstakeSAVAXYak',
            },
        ],
        USDC: [
            {
                protocol: 'VECTOR_FINANCE',
                apy: () => yyApy('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95'),
                staked: (address) => yyStaked('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakeMethod: 'vectorStakeUSDC1',
                unstakeMethod: 'vectorUnstakeUSDC1',
            },
            {
                protocol: 'VECTOR_FINANCE',
                apy: async () => yyApy('0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557'),
                staked: async (address) => yyStaked('0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557', address),
                stakeMethod: 'vectorStakeUSDC2',
                unstakeMethod: 'vectorUnstakeUSDC2',
            },
        ],
        TJ_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                apy: () => yyApy('0xf4003F4efBE8691B60249E6afbD307aBE7758adb'),
                staked: (address) => yyStaked('0xf4003F4efBE8691B60249E6afbD307aBE7758adb', address),
                stakeMethod: 'stakeTJAVAXUSDCYak',
                unstakeMethod: 'unstakeTJAVAXUSDCYak',
            }
        ],
    },
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/delta-prime"
}
