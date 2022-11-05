import addresses from '../common/addresses/avax/token_addresses.json';
import {vectorFinanceApy, vectorFinanceBalance, yieldYakApy, yieldYakBalance} from "./utils/calculate";
import WAVAX_POOL_TUP from '@contracts/WavaxPoolTUP.json';
import USDC_POOL_TUP from '@contracts/UsdcPoolTUP.json';

export default {
    MAX_COLLATERAL: 500,
    MIN_ALLOWED_HEALTH: 0.2,
    COMPETITION_START_BLOCK: 14858534,
    chainId: 1337,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "AVAX": {name: "AVAX", symbol: "AVAX", decimals: 18, address: addresses.AVAX, maxLeverage: 0.83333333333},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, maxLeverage: 0.83333333333},
      "BTC": {name: "Bitcoin", symbol: "BTC", decimals: 8, address: addresses.BTC, maxLeverage: 0.83333333333},
      "ETH": {name: "Ether", symbol: "ETH", decimals: 18, address: addresses.ETH, maxLeverage: 0.83333333333},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, maxLeverage: 0.83333333333},
      "LINK": {name: "Link", symbol: "LINK", decimals: 18, address: addresses.LINK, maxLeverage: 0.83333333333},
      "sAVAX": {name: "sAVAX", symbol: "sAVAX", decimals: 18, address: addresses.sAVAX, maxLeverage: 0.83333333333}
    },
    POOLS_CONFIG: {
        AVAX: {
            address: WAVAX_POOL_TUP.address,
            tokenAddress: addresses.AVAX
        },
        USDC: {
            address: USDC_POOL_TUP.address,
            tokenAddress: addresses.USDC
        }
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
                apy: async () => yieldYakApy('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95'),
                staked: async (address) => yieldYakBalance('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakeMethod: 'stakeAVAXYak',
                unstakeMethod: 'unstakeAVAXYak',
                feedSymbol: 'YYAV3SA1',
                token: 'AVAX'
            },
            {
                protocol: 'VECTOR_FINANCE',
                apy: async () => vectorFinanceApy('AVAX'),
                staked: async (address) => vectorFinanceBalance('0xff5386aF93cF4bD8d5AeCad6df7F4f4be381fD69', address),
                stakeMethod: 'vectorStakeWAVAX1',
                unstakeMethod: 'vectorUnstakeWAVAX1',
                token: 'AVAX'
            }
        ],
        sAVAX: [
            {
                protocol: 'VECTOR_FINANCE',
                apy: () => vectorFinanceApy('SAVAX'),
                staked: (address) => vectorFinanceBalance('0x812b7C3b5a9164270Dd8a0b3bc47550877AECdB1', address),
                stakeMethod: 'vectorStakeSAVAX1',
                unstakeMethod: 'vectorUnstakeSAVAX1',
                feedSymbol: 'SAV2',
                token: 'SAVAX'
            },
            {
                protocol: 'YIELD_YAK',
                apy: async () => yieldYakApy('0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557'),
                staked: async (address) => yieldYakBalance('0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557', address),
                stakeMethod: 'stakeSAVAXYak',
                unstakeMethod: 'unstakeSAVAXYak',
                token: 'SAVAX'
            },
        ],
        USDC: [
            {
                protocol: 'VECTOR_FINANCE',
                //TODO: check if it's a right APY
                apy: () => vectorFinanceApy('USDC'),
                staked: (address) => vectorFinanceBalance('0x7550B2d6a1F039Dd6a3d54a857FEFCbF77213D80', address, 6),
                stakeMethod: 'vectorStakeUSDC1',
                unstakeMethod: 'vectorUnstakeUSDC1',
                token: 'USDC'
            },
            {
                protocol: 'VECTOR_FINANCE',
                //TODO: check if it's a right APY
                apy: async () => vectorFinanceApy('USDC'),
                staked: async (address) => vectorFinanceBalance('0xDA9E515Ce714c4309f7C4483F4802556AE5Df396', address, 6),
                stakeMethod: 'vectorStakeUSDC2',
                unstakeMethod: 'vectorUnstakeUSDC2',
                token: 'USDC'
            },
        ],
        TJ_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                apy: () => yieldYakApy('0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC'),
                staked: (address) => yieldYakBalance('0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC', address),
                stakeMethod: 'stakeTJAVAXUSDCYak',
                unstakeMethod: 'unstakeTJAVAXUSDCYak',
                feedSymbol: 'YY_TJ_AVAX_USDC_LP',
                token: 'TJ_AVAX_USDC_LP'
            }
        ],
    },
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    MAX_POOL_UTILISATION: 0.95,
    dataProviderId: "redstone-avalanche-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/delta-prime"
}
