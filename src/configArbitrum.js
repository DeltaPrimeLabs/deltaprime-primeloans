import addresses from '../common/addresses/arbitrum/token_addresses.json';
import USDC_POOL_TUP from '/deployments/arbitrum/UsdcPoolTUP.json';
import ARB_POOL_TUP from '/deployments/arbitrum/ArbPoolTUP.json';
import USDT_POOL_TUP from '/deployments/arbitrum/UsdtPoolTUP.json';
import BTC_POOL_TUP from '/deployments/arbitrum/BtcPoolTUP.json';
import WETH_POOL_TUP from '/deployments/arbitrum/WethPoolTUP.json';
import DAI_POOL_TUP from '/deployments/arbitrum/DaiPoolTUP.json';
import FRAX_POOL_TUP from '/deployments/arbitrum/FraxPoolTUP.json';
import LINK_POOL_TUP from '/deployments/arbitrum/LinkPoolTUP.json';
import SUSHISWAP_INTERMEDIARY_TUP from '../deployments/arbitrum/SushiSwapIntermediaryTUP.json';
import {yieldYakBalance} from './utils/calculate';

export default {
    MIN_ALLOWED_HEALTH: 0.0182,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    disableAWSData: false,
    chainId: 42161,
    chainSlug: 'arbitrum',
    primeAccountsBlocked: true,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ETHUSDT"},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:USDCUSDT"},
      "ARB": {name: "ARB", symbol: "ARB", logoExt: "png", decimals: 18, address: addresses.ARB, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ARBUSDT"},
      "BTC": {name: "BTC", symbol: "BTC", logoExt: "png", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:BTCUSDT"},
      "DAI": {name: "DAI", symbol: "DAI", logoExt: "png", decimals: 18, isStableCoin: true, address: addresses.DAI, debtCoverage: 0.83333333333, tradingViewSymbol: "KRAKEN:DAIUSDT"},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "COINBASE:USDTUSD"},
      "FRAX": {name: "FRAX", symbol: "FRAX", decimals: 18, isStableCoin: true, address: addresses.FRAX, debtCoverage: 0.83333333333, tradingViewSymbol: "POLONIEX:FRAXUSDT"},
      "USDC.e": {name: "USDC.e", symbol: "USDC.e", decimals: 6, address: addresses["USDC.e"], isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "TRADERJOE:USDTEUSDT_74B651"},
      "UNI": {name: "UNI", symbol: "UNI", logoExt: "png", decimals: 18, address: addresses.UNI, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:UNIUSDT"},
      "LINK": {name: "LINK", symbol: "LINK", decimals: 18, address: addresses.LINK, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:LINKUSDT"},
      "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:GMXUSDT"},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333, tradingViewSymbol: ""},
      // "DPX": {name: "DPX", symbol: "DPX", logoExt: "png", decimals: 18, address: addresses.DPX, debtCoverage: 0.83333333333, tradingViewSymbol: "BYBIT:DPXUSDT"},
      "MAGIC": {name: "MAGIC", symbol: "MAGIC", logoExt: "png", decimals: 18, address: addresses.MAGIC, groupIdentifier: "MAGIC_GROUP", debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:MAGICUSDT"},
      "WOO": {name: "WOO", symbol: "WOO", logoExt: "png", decimals: 18, address: addresses.WOO, groupIdentifier: "WOO_GROUP", debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:WOOUSDT"},
      "wstETH": {name: "wstETH", symbol: "wstETH", logoExt: "png", decimals: 18, address: addresses.wstETH, debtCoverage: 0.83333333333, tradingViewSymbol: "UNISWAP3ETH:WSTETHUSDC"},
      "JOE": {name: "JOE", symbol: "JOE", logoExt: "png", decimals: 18, address: addresses.JOE, groupIdentifier: "JOE_GROUP", debtCoverage: 0.8, tradingViewSymbol: "BINANCE:JOEUSDT"},
      "GRAIL": {name: "GRAIL", symbol: "GRAIL", logoExt: "png", decimals: 18, address: addresses.GRAIL, groupIdentifier: "GRAIL_GROUP", debtCoverage: 0.8, tradingViewSymbol: "BITGET:GRAILUSDT"},
    },
    AVAILABLE_ASSETS_PER_DEX: {
        YakSwap: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH', 'WOO', 'GRAIL', 'JOE'],
        ParaSwap: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH', 'WOO', 'GRAIL', 'JOE']
    },

    SWAP_DEXS_CONFIG: {
        YakSwap: {
            displayName: 'YakSwap',
            availableAssets: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH', 'GRAIL', 'WOO', 'MAGIC', 'JOE'],
            slippageMargin: 0.02
        },
        ParaSwapV2: {
            displayName: 'ParaSwap',
            availableAssets: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH', 'GRAIL', 'WOO', 'MAGIC', 'JOE'],
            slippageMargin: 0.05
        },
        Level: {
            availableAssets: [],
            slippageMargin: 0.1
        },
        GmxV2: {
            availableAssets: [],
            slippageMargin: 0.1
        }
    },
    paraSwapDefaultSlippage: 0.02,
    showYakSwapWarning: true,
    ASSET_FILTER_TOKENS_OPTIONS: ['ETH', 'DPX',],
    ASSET_FILTER_DEXES_OPTIONS: ['Sushi'],
    NATIVE_ASSET_TOGGLE_OPTIONS: ['ETH', 'WETH'],
    WRAPPED_TOKEN_ADDRESS: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    POOLS_CONFIG: {
        USDC: {
            address: USDC_POOL_TUP.address,
            tokenAddress: addresses.USDC
        },
        ETH: {
            address: WETH_POOL_TUP.address,
            tokenAddress: addresses.ETH
        },
        ARB: {
            address: ARB_POOL_TUP.address,
            tokenAddress: addresses.ARB
        },
        BTC: {
            address: BTC_POOL_TUP.address,
            tokenAddress: addresses.BTC
        },
        DAI: {
            address: DAI_POOL_TUP.address,
            tokenAddress: addresses.DAI,
        },
        USDT: {
            address: USDT_POOL_TUP.address,
            tokenAddress: addresses.USDT,
            disabled: true
        },
        FRAX: {
            address: FRAX_POOL_TUP.address,
            tokenAddress: addresses.FRAX,
            disabled: true
        },
        LINK: {
            address: LINK_POOL_TUP.address,
            tokenAddress: addresses.LINK,
            disabled: true
        }
    },
    poolsUnlocking: true,
    TRADERJOEV2_LP_ASSETS_CONFIG: {
        'TJLB_MAGIC_ETH': { primary: 'MAGIC', secondary: 'ETH', name: 'MAGIC-ETH', dex: 'TraderJoe', symbol: 'TJLB_MAGIC_ETH', decimals: 18, baseFee: '0.0025', address: addresses['TJLB_MAGIC_ETH'], binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x539bdE0d7Dbd336b79148AA742883198BBF60342/ETH/25"},
        'TJLB_GMX_ETH': { primary: 'GMX', secondary: 'ETH', name: 'GMX-ETH', dex: 'TraderJoe', symbol: 'TJLB_GMX_ETH', decimals: 18, baseFee: '0.002', address: addresses['TJLB_GMX_ETH'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a/ETH/20"},
        'TJLB_DAI_USDCe': { primary: 'DAI', secondary: 'USDC.e', name: 'DAI-USDCe', dex: 'TraderJoe', symbol: 'TJLB_DAI_USDCe', decimals: 18, baseFee: '0.00005', address: addresses['TJLB_DAI_USDCe'], binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xda10009cbd5d07dd0cecc66161fc93d7c9000da1/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/1"},
        'TJLB_ETH_USDT': { primary: 'ETH', secondary: 'USDT', name: 'ETH-USDT', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDT', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDT'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9/15"},
        'TJLB_ETH_USDCe': { primary: 'ETH', secondary: 'USDC.e', name: 'ETH-USDCe', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDCe', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDCe'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/15"},
        'TJLB_ARB_ETH': { primary: 'ARB', secondary: 'ETH', name: 'ARB-ETH', dex: 'TraderJoe', symbol: 'TJLB_ARB_ETH', decimals: 18, baseFee: '0.001', address: addresses['TJLB_ARB_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x912ce59144191c1204e64559fe8253a0e49e6548/ETH/10"},
        'TJLB_BTC_ETH': { primary: 'BTC', secondary: 'ETH', name: 'BTC-ETH', dex: 'TraderJoe', symbol: 'TJLB_BTC_ETH', decimals: 18, baseFee: '0.001', address: addresses['TJLB_BTC_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f/ETH/10"},
        'TJLB_GRAIL_ETH': { primary: 'GRAIL', secondary: 'ETH', name: 'GRAIL-ETH', dex: 'TraderJoe', symbol: 'TJLB_GRAIL_ETH', decimals: 18, baseFee: '0.0025', address: addresses['TJLB_GRAIL_ETH'], binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x3d9907f9a368ad0a51be60f7da3b97cf940982d8/ETH/25"},
        'TJLB_WOO_ETH': { primary: 'WOO', secondary: 'ETH', name: 'WOO-ETH', dex: 'TraderJoe', symbol: 'TJLB_WOO_ETH', decimals: 18, baseFee: '0.0025', address: addresses['TJLB_WOO_ETH'], binStep: 25, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xcafcd85d8ca7ad1e1c6f82f651fa15e33aefd07b/ETH/25"},
        'TJLB_JOE_ETH': { primary: 'JOE', secondary: 'ETH', name: 'JOE-ETH', dex: 'TraderJoe', symbol: 'TJLB_JOE_ETH', decimals: 18, baseFee: '0.002', address: addresses['TJLB_JOE_ETH'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x371c7ec6d8039ff7933a2aa28eb827ffe1f52f07/ETH/20"},
        'TJLB_USDT_USDCe': { primary: 'USDT', secondary: 'USDC.e', name: 'USDT-USDCe', dex: 'TraderJoe', symbol: 'TJLB_USDT_USDCe', decimals: 18, baseFee: '0.00005', address: addresses['TJLB_USDT_USDCe'], binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/1"},
        'TJLB_ETH_USDC': { primary: 'ETH', secondary: 'USDC', name: 'ETH-USDC', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDC', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDC'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xaf88d065e77c8cc2239327c5edb3a432268e5831/15"},
    },
    BALANCER_LP_ASSETS_CONFIG: {},
    LEVEL_LP_ASSETS_CONFIG: {
        "arbJnrLLP": {name: "Junior", symbol: "arbJnrLLP", pid: 2, short: "Jnr", decimals: 18, address: addresses.arbJnrLLP, debtCoverage: 0.83333333333, balanceMethod: "levelJnrBalance", groupIdentifier: 'STKD_JNR_LLP_GROUP', underlyingAssets: ['BTC', 'ETH', 'ARB', 'USDT', 'USDC'], link: 'https://app.level.finance/liquidity/junior-tranche/buy', disableAddTokenButton: true},
        "arbMzeLLP": {name: "Mezzanine", symbol: "arbMzeLLP", pid: 1, short: "Mze", decimals: 18, address: addresses.arbMzeLLP, debtCoverage: 0.83333333333, balanceMethod: "levelMzeBalance", groupIdentifier: 'STKD_MZE_LLP_GROUP', underlyingAssets: ['BTC', 'ETH', 'USDT', 'USDC'], link: 'https://app.level.finance/liquidity/mezzanine-tranche/buy', disableAddTokenButton: true},
        "arbSnrLLP": {name: "Senior", symbol: "arbSnrLLP", pid: 0, short: "Snr", decimals: 18, address: addresses.arbSnrLLP, debtCoverage: 0.83333333333, balanceMethod: "levelSnrBalance", groupIdentifier: 'STKD_SNR_LLP_GROUP', underlyingAssets: ['BTC', 'ETH', 'USDT', 'USDC'], link: 'https://app.level.finance/liquidity/senior-tranche/buy'},
    },
    GMX_V2_ASSETS_CONFIG: {
        "GM_ETH_WETH_USDC": {name: "ETH-USDC", symbol: "GM_ETH_WETH_USDC", short: "GM", decimals: 18, address: addresses.GM_ETH_WETH_USDC, debtCoverage: 0.83333333333, longToken: 'ETH', shortToken: 'USDC', indexTokenAddress: addresses.ETH, link: 'https://app.gmx.io/#/stats'},
        "GM_BTC_WBTC_USDC": {name: "BTC-USDC", symbol: "GM_BTC_WBTC_USDC", short: "GM", logoExt: "png", price: 1, decimals: 18, address: addresses.GM_BTC_WBTC_USDC, debtCoverage: 0.83333333333, longToken: 'BTC', shortToken: 'USDC', indexTokenAddress: addresses.BTC, link: 'https://app.gmx.io/#/stats'},
        "GM_ARB_ARB_USDC": {name: "ARB-USDC", symbol: "GM_ARB_ARB_USDC", short: "GM", logoExt: "png", decimals: 18, address: addresses.GM_ARB_ARB_USDC, debtCoverage: 0.83333333333, longToken: 'ARB', shortToken: 'USDC', indexTokenAddress: addresses.ARB, link: 'https://app.gmx.io/#/stats'},
        "GM_UNI_UNI_USDC": {name: "UNI-USDC", symbol: "GM_UNI_UNI_USDC", short: "GM", logoExt: "png", price: 1, decimals: 18, address: addresses.GM_UNI_UNI_USDC, debtCoverage: 0.83333333333, longToken: 'UNI', shortToken: 'USDC', indexTokenAddress: addresses.UNI, link: 'https://app.gmx.io/#/stats'},
        "GM_LINK_LINK_USDC": {name: "LINK-USDC", symbol: "GM_LINK_LINK_USDC", short: "GM", price: 1, decimals: 18, address: addresses.GM_LINK_LINK_USDC, debtCoverage: 0.83333333333, longToken: 'LINK', shortToken: 'USDC', indexTokenAddress: addresses.LINK, link: 'https://app.gmx.io/#/stats'},
    },
    LP_ASSETS_CONFIG: {
        // "SUSHI_DPX_ETH_LP": {
        //     primary: 'DPX',
        //     secondary: 'ETH',
        //     name: "DPX-ETH",
        //     dex: 'Sushi',
        //     symbol: 'SUSHI_DPX_ETH_LP',
        //     decimals: 18,
        //     address: addresses.SUSHI_DPX_ETH_LP,
        //     debtCoverage: 0.83333333333
        // },
    },
    CONCENTRATED_LP_ASSETS_CONFIG: {},
    DEX_CONFIG: {
        'Sushi': {
            intermediaryAddress: SUSHISWAP_INTERMEDIARY_TUP.address,
            routerAddress: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
            swapMethod: 'swapSushiSwap',
            addLiquidityMethod: 'addLiquiditySushiSwap',
            removeLiquidityMethod: 'removeLiquiditySushiSwap',
            logo: 'sushi.png'
        }
    },
    PROTOCOLS_CONFIG: {
        YIELD_YAK: {
            logo: 'yak.svg',
            name: 'Yield Yak'
        },
        BEEFY_FINANCE: {
            logo: 'beefy.png',
            name: 'Beefy Finance'
        },
    },
    FARMED_TOKENS_CONFIG: {
        "USDC.e": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_USDC.e',
                balance: async (address) => yieldYakBalance('0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C', address, 6),
                stakingContractAddress: '0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C',
                decimals: 6, //decimals of staking contract
                stakeMethod: 'stakeUSDCeYak',
                unstakeMethod: 'unstakeUSDCeYak',
                feedSymbol: 'YY_WOMBEX_USDC.e',
                symbol: 'YRT',
                token: 'USDC.e',
                isTokenLp: false,
                info: 'Provides liquidity to Wombex.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['USDC.e'],
                strategy: 'Wombex',
                refreshDelay: 60000
            }
        ],
        "USDT": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_USDT',
                balance: async (address) => yieldYakBalance('0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2', address, 6),
                stakingContractAddress: '0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2',
                decimals: 6, //decimals of staking contract
                stakeMethod: 'stakeUSDTYak',
                unstakeMethod: 'unstakeUSDTYak',
                feedSymbol: 'YY_WOMBEX_USDT',
                symbol: 'YRT',
                token: 'USDT',
                isTokenLp: false,
                info: 'Provides liquidity to Wombex.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['USDT'],
                strategy: 'Wombex',
                refreshDelay: 60000
            }
        ],
        "DAI": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_DAI',
                balance: async (address) => yieldYakBalance('0x1817fE376740b53CAe73224B7F0a57F23DD4C9b5', address, 18),
                stakingContractAddress: '0x1817fE376740b53CAe73224B7F0a57F23DD4C9b5',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeDAIYak',
                unstakeMethod: 'unstakeDAIYak',
                feedSymbol: 'YY_WOMBEX_DAI',
                symbol: 'YRT',
                token: 'DAI',
                isTokenLp: false,
                info: 'Provides liquidity to Wombex.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['DAI'],
                strategy: 'Wombex',
                refreshDelay: 60000
            }
        ],
        "GMX": [
            {
                protocol: 'BEEFY_FINANCE',
                autoCompounding: true,
                protocolIdentifier: 'MOO_GMX',
                balance: async (address) => yieldYakBalance('0x5B904f19fb9ccf493b623e5c8cE91603665788b0', address),
                stakingContractAddress: '0x5B904f19fb9ccf493b623e5c8cE91603665788b0',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeGmxBeefy',
                unstakeMethod: 'unstakeGmxBeefy',
                feedSymbol: 'MOO_GMX',
                symbol: 'BEEFY',
                token: 'GMX',
                isTokenLp: false,
                info: 'Stakes GMX token.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['GMX'],
                strategy: 'GMX',
                refreshDelay: 60000
            }
        ],
        "GLP": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_GLP',
                balance: async (address) => yieldYakBalance('0x28f37fa106AA2159c91C769f7AE415952D28b6ac', address),
                stakingContractAddress: '0x28f37fa106AA2159c91C769f7AE415952D28b6ac',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeGLPYak',
                unstakeMethod: 'unstakeGLPYak',
                feedSymbol: 'YY_WOMBEX_GLP',
                symbol: 'YRT',
                token: 'GLP',
                isTokenLp: false,
                info: 'Continuously stakes esGMX in order to maximize GLP rewards.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['GLP'],
                strategy: 'GMX',
                refreshDelay: 60000
            }
        ],
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
    },
    yakRouterAddress: '0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3',
    yakWrapRouterAddress: '0x16f90031000d48ce2bc6577788282c232060c547',
    yieldYakGlpWrapperAddress: '0x80F2d9652Ed7F5306dB095882FA9Ff882003F6D1',
    glpRewardsRouterAddress: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1', //TODO: needs testing
    depositSwapAddress: "0x889Cfe41a376CFeF8F28E48A848728D5377552b9",
    levelLiquidityCalculatorAddress: "0xf1e5D6c0ce39fDBb9682F1A3385f0d2067740C61",
    gmxV2ReaderAddress: "0xf60becbba223eea9495da3f606753867ec10d139",
    gmxV2DataStoreAddress: "0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8",
    gmxV2HighExecutionFee: 0,
    gmxV2DepositCallbackGasLimit: 300000,
    gmxV2WithdrawalCallbackGasLimit: 300000,
    gmxV2GasPriceBuffer: 0.1,
    gmxV2GasPricePremium: 0,
    gmxV2UseMaxPriorityFeePerGas: false,
    nativeToken: "ETH",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-arbitrum-prod",
    dataProviderHistoricalPrices: "redstone",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/keizir/deltaprime",
    readRpcUrl: "https://arbitrum-mainnet.core.chainstack.com/9a30fb13b2159a76c8e143c52d5579bf",
    multicallAddress: "0x0674ee727f74752ea9dc630bd5c5d8a374187e7b",
    EMAIL_REGEX: /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/,
    refreshDelay: 2000,
    gmxV2RefreshDelay: 4000,
    historicalRpcUrl: "https://nd-767-190-280.p2pify.com/8d546b2f3519965f0f1cb4332abe96b3",
}
