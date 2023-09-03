import addresses from '../common/addresses/arbitrum/token_addresses.json';
import USDC_POOL_TUP from '/deployments/arbitrum/UsdcPoolTUP.json';
import USDT_POOL_TUP from '/deployments/arbitrum/UsdtPoolTUP.json';
import BTC_POOL_TUP from '/deployments/arbitrum/BtcPoolTUP.json';
import WETH_POOL_TUP from '/deployments/arbitrum/WethPoolTUP.json';
import DAI_POOL_TUP from '/deployments/arbitrum/DaiPoolTUP.json';
import FRAX_POOL_TUP from '/deployments/arbitrum/FraxPoolTUP.json';
import LINK_POOL_TUP from '/deployments/arbitrum/LinkPoolTUP.json';
import PANGOLIN_INTERMEDIARY_TUP from '../deployments/avalanche/PangolinIntermediaryTUP.json';
import TRADERJOE_INTERMEDIARY_TUP from '../deployments/avalanche/TraderJoeIntermediaryTUP.json';
import {vectorFinanceBalance, yieldYakBalance} from './utils/calculate';

export default {
    MIN_ALLOWED_HEALTH: 0.0182,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    chainId: 42161,
    chainSlug: 'arbitrum',
    primeAccountsBlocked: true,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333},
      "BTC": {name: "BTC", symbol: "BTC", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333},
      "DAI": {name: "DAI", symbol: "DAI", logoExt: "png", decimals: 18, isStableCoin: true, address: addresses.DAI, debtCoverage: 0.83333333333},
      "FRAX": {name: "FRAX", symbol: "FRAX", decimals: 18, isStableCoin: true, address: addresses.FRAX, debtCoverage: 0.83333333333},
      "USDC.e": {name: "USDC.e", symbol: "USDC.e", decimals: 6, address: addresses["USDC.e"], isStableCoin: true, debtCoverage: 0.83333333333},
      "UNI": {name: "UNI", symbol: "UNI", logoExt: "png", decimals: 18, address: addresses.UNI, debtCoverage: 0.83333333333},
      "LINK": {name: "LINK", symbol: "LINK", decimals: 18, address: addresses.LINK, debtCoverage: 0.83333333333},
      "ARB": {name: "ARB", symbol: "ARB", logoExt: "png", decimals: 18, address: addresses.ARB, debtCoverage: 0.83333333333},
      "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333},
      "wstETH": {name: "wstETH", symbol: "wstETH", logoExt: "png", decimals: 18, address: addresses.wstETH, debtCoverage: 0.83333333333},
    },
    AVAILABLE_ASSETS_PER_DEX: {
        YakSwap: ['ETH', 'USDC', 'USDT', 'ARB', 'BTC', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH'],
        ParaSwap: ['ETH', 'USDC', 'USDT', 'ARB', 'BTC', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH']
    },
    ASSET_FILTER_TOKENS_OPTIONS: ['USDC', 'ETH',],
    ASSET_FILTER_DEXES_OPTIONS: ['Pangolin', 'TraderJoe'],
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
        BTC: {
            address: BTC_POOL_TUP.address,
            tokenAddress: addresses.BTC,
            disabled: true
        },
        DAI: {
            address: DAI_POOL_TUP.address,
            tokenAddress: addresses.DAI,
            disabled: true
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
        'TJLB_DAI_USDCe': { primary: 'DAI', secondary: 'USDC.e', name: 'DAI-USDCe', dex: 'TraderJoe', symbol: 'TJLB_DAI_USDCe', decimals: 18, baseFee: '0.00005', address: addresses['TJLB_DAI_USDCe'], binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
        'TJLB_ETH_USDT': { primary: 'ETH', secondary: 'USDT', name: 'ETH-USDT', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDT', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDT'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
        'TJLB_ETH_USDCe': { primary: 'ETH', secondary: 'USDC.e', name: 'ETH-USDCe', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDCe', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDCe'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
        'TJLB_GMX_ETH': { primary: 'GMX', secondary: 'ETH', name: 'GMX-ETH', dex: 'TraderJoe', symbol: 'TJLB_GMX_ETH', decimals: 18, baseFee: '0.002', address: addresses['TJLB_GMX_ETH'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
        'TJLB_BTC_ETH': { primary: 'BTC', secondary: 'ETH', name: 'BTC-ETH', dex: 'TraderJoe', symbol: 'TJLB_BTC_ETH', decimals: 18, baseFee: '0.001', address: addresses['TJLB_BTC_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2'},
    },
    LP_ASSETS_CONFIG: {},
    CONCENTRATED_LP_ASSETS_CONFIG: {},
    DEX_CONFIG: {
        'Pangolin': {
            logo: 'png.png'
        },
        'TraderJoe': {
            logo: 'joe.png'
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
                balance: async (address) => yieldYakBalance('0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C', address),
                stakingContractAddress: '0x4649c7c3316B27C4A3DB5f3B47f87C687776Eb8C',
                decimals: 18, //decimals of staking contract
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
                strategy: 'USDC.e',
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
            }
        ],
        "USDT": [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                protocolIdentifier: 'YY_WOMBEX_USDT',
                balance: async (address) => yieldYakBalance('0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2', address),
                stakingContractAddress: '0x8Bc6968b7A9Eed1DD0A259eFa85dc2325B923dd2',
                decimals: 18, //decimals of staking contract
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
                strategy: 'USDT',
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
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
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
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
                stakeMethod: 'stakeGLPYakk',
                unstakeMethod: 'unstakeGLPYak',
                feedSymbol: 'YY_WOMBEX_GLP',
                symbol: 'YRT',
                token: 'USDT',
                isTokenLp: false,
                info: 'Continuously stakes esGMX in order to maximize GLP rewards.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['GLP'],
                strategy: 'GLP',
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
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
    yieldYakGlpWrapperAddress: '0x5190B15497e5EC8Fb94eFac4ebd8B089645F68c2',
    glpRewardsRouterAddress: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1', //TODO: needs testing
    nativeToken: "ETH",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-arbitrum-prod",
    dataProviderHistoricalPrices: "redstone",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/keizir/deltaprime"
}
