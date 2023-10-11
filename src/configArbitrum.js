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
    chainId: 42161,
    chainSlug: 'arbitrum',
    primeAccountsBlocked: true,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ETHUSDT"},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:USDCUSDT"},
      "ARB": {name: "ARB", symbol: "ARB", logoExt: "png", decimals: 18, address: addresses.ARB, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ARBUSDT"},
      "BTC": {name: "BTC", symbol: "BTC", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:BTCUSDT"},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "COINBASE:USDTUSD"},
      "DAI": {name: "DAI", symbol: "DAI", logoExt: "png", decimals: 18, isStableCoin: true, address: addresses.DAI, debtCoverage: 0.83333333333, tradingViewSymbol: "KRAKEN:DAIUSDT"},
      "FRAX": {name: "FRAX", symbol: "FRAX", decimals: 18, isStableCoin: true, address: addresses.FRAX, debtCoverage: 0.83333333333, tradingViewSymbol: "POLONIEX:FRAXUSDT"},
      "USDC.e": {name: "USDC.e", symbol: "USDC.e", decimals: 6, address: addresses["USDC.e"], isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "TRADERJOE:USDTEUSDT_74B651"},
      "UNI": {name: "UNI", symbol: "UNI", logoExt: "png", decimals: 18, address: addresses.UNI, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:UNIUSDT"},
      "LINK": {name: "LINK", symbol: "LINK", decimals: 18, address: addresses.LINK, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:LINKUSDT"},
      "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:GMXUSDT"},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333, tradingViewSymbol: ""},
      // "DPX": {name: "DPX", symbol: "DPX", logoExt: "png", decimals: 18, address: addresses.DPX, debtCoverage: 0.83333333333, tradingViewSymbol: "BYBIT:DPXUSDT"},
      "wstETH": {name: "wstETH", symbol: "wstETH", logoExt: "png", decimals: 18, address: addresses.wstETH, debtCoverage: 0.83333333333, tradingViewSymbol: "UNISWAP3ETH:WSTETHUSDC"},
    },
    AVAILABLE_ASSETS_PER_DEX: {
        YakSwap: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH'],
        ParaSwap: ['ETH', 'USDC', 'USDT', 'USDC.e', 'ARB', 'BTC', 'GMX', 'DAI', 'FRAX', 'LINK', 'UNI', 'wstETH']
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
        'TJLB_DAI_USDCe': { primary: 'DAI', secondary: 'USDC.e', name: 'DAI-USDCe', dex: 'TraderJoe', symbol: 'TJLB_DAI_USDCe', decimals: 18, baseFee: '0.00005', address: addresses['TJLB_DAI_USDCe'], binStep: 1, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0xda10009cbd5d07dd0cecc66161fc93d7c9000da1/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/1"},
        'TJLB_ETH_USDT': { primary: 'ETH', secondary: 'USDT', name: 'ETH-USDT', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDT', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDT'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9/15"},
        'TJLB_ETH_USDCe': { primary: 'ETH', secondary: 'USDC.e', name: 'ETH-USDCe', dex: 'TraderJoe', symbol: 'TJLB_ETH_USDCe', decimals: 18, baseFee: '0.0015', address: addresses['TJLB_ETH_USDCe'], binStep: 15, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/ETH/0xff970a61a04b1ca14834a43f5de4533ebddb5cc8/15"},
        'TJLB_ARB_ETH': { primary: 'ARB', secondary: 'ETH', name: 'ARB-ETH', dex: 'TraderJoe', symbol: 'TJLB_ARB_ETH', decimals: 18, baseFee: '0.001', address: addresses['TJLB_ARB_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x912ce59144191c1204e64559fe8253a0e49e6548/ETH/10"},
        'TJLB_BTC_ETH': { primary: 'BTC', secondary: 'ETH', name: 'BTC-ETH', dex: 'TraderJoe', symbol: 'TJLB_BTC_ETH', decimals: 18, baseFee: '0.001', address: addresses['TJLB_BTC_ETH'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/arbitrum/pool/v21/0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f/ETH/10"},
    },
    LEVEL_LP_ASSETS_CONFIG: {
        "arbJnrLLP": {name: "Junior Tranche", symbol: "arbJnrLLP", short: "Jnr", logoExt: "png", decimals: 18, address: addresses.arbJnrLLP, debtCoverage: 0.83333333333, balanceMethod: "levelJnrBalance", underlyingAssets: ['BTC', 'ETH', 'ARB', 'USDT', 'USDC']},
        "arbMzeLLP": {name: "Mezzanine Tranche", symbol: "arbMzeLLP", short: "Mze", logoExt: "png", decimals: 18, address: addresses.arbMzeLLP, debtCoverage: 0.83333333333, balanceMethod: "levelMzeBalance", underlyingAssets: ['BTC', 'ETH', 'USDT', 'USDC']},
        "arbSnrLLP": {name: "Senior Tranche", symbol: "arbSnrLLP", short: "Snr", logoExt: "png", decimals: 18, address: addresses.arbSnrLLP, debtCoverage: 0.83333333333, balanceMethod: "levelSnrBalance", underlyingAssets: ['BTC', 'ETH', 'USDT', 'USDC']},
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
                strategy: 'USDC.e',
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
                strategy: 'USDT',
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
                strategy: 'DAI',
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
                strategy: 'GLP',
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
    nativeToken: "ETH",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-arbitrum-prod",
    dataProviderHistoricalPrices: "redstone",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/keizir/deltaprime",
    readRpcUrl: "https://nd-762-566-527.p2pify.com/4514bd12de6723b94346752e90e95cf4"
}
