import addresses from '../common/addresses/avalanche/token_addresses.json';
import {
    vectorFinanceBalance,
    yieldYakBalance
} from "./utils/calculate";
import WAVAX_POOL_TUP from '/deployments/avalanche/WavaxPoolTUP.json';
import USDC_POOL_TUP from '/deployments/avalanche/UsdcPoolTUP.json';
import USDT_POOL_TUP from '/deployments/avalanche/UsdtPoolTUP.json';
import BTC_POOL_TUP from '/deployments/avalanche/BtcPoolTUP.json';
import ETH_POOL_TUP from '/deployments/avalanche/EthPoolTUP.json';
import PANGOLIN_INTERMEDIARY_TUP from '/deployments/avalanche/PangolinIntermediaryTUP.json';
import TRADERJOE_INTERMEDIARY_TUP from '/deployments/avalanche/TraderJoeIntermediaryTUP.json';

export default {
    MIN_ALLOWED_HEALTH: 0.0182,
    COMPETITION_START_BLOCK: 14858534,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    disableAWSData: false,
    chainId: 43114,
    chainSlug: 'avalanche',
    notifiEnabled: true,
    // chainId: 1337,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "AVAX": {name: "AVAX", symbol: "AVAX", decimals: 18, address: addresses.AVAX, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:AVAXUSDT"},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:USDCUSDT"},
      "BTC": {name: "BTC", symbol: "BTC", logoExt: "png", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:BTCUSDT"},
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333, tradingViewSymbol: "BINANCE:ETHUSDT"},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "COINBASE:USDTUSD"},
      "USDT.e": {inactive: true, name: "USDT.e", symbol: "USDT.e", decimals: 6, address: addresses['USDT.e'],  isStableCoin: true, debtCoverage: 0.83333333333, tradingViewSymbol: "TRADERJOE:USDTEUSDT_74B651"},
      "EUROC": {name: "EUROC", symbol: "EUROC", logoExt: "png", decimals: 6, address: addresses.EUROC, debtCoverage: 0.83333333333, groupIdentifier: "EUROC_GROUP", tradingViewSymbol: "COINBASE:EUROCUSD"},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333, swappableAssets: ['BTC', 'ETH', 'USDC'], tradingViewSymbol: ""},
      "sAVAX": {name: "sAVAX", symbol: "sAVAX", decimals: 18, address: addresses.sAVAX, debtCoverage: 0.83333333333, apy: 6.06, tradingViewSymbol: "TRADERJOE:SAVAXWAVAX_4B946C.USD"},
      "yyAVAX": {name: "yyAVAX", symbol: "yyAVAX", logoExt: "png", decimals: 18, address: addresses.yyAVAX, debtCoverage: 0.83333333333, apy: 4.86, tradingViewSymbol: "TRADERJOE:YYAVAXUSDC_0512AB.USD"},
      "ggAVAX": {name: "ggAVAX", symbol: "ggAVAX", logoExt: "png", decimals: 18, address: addresses.ggAVAX, debtCoverage: 0.83333333333, apy: 5.04, useParaSwapV2: true },
      "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333, groupIdentifier: "GMX_GROUP", tradingViewSymbol: "BINANCE:GMXUSDT"},
      "JOE": {name: "JOE", symbol: "JOE", logoExt: "png", decimals: 18, address: addresses.JOE, debtCoverage: 0.8, groupIdentifier: "JOE_GROUP", tradingViewSymbol: "BINANCE:JOEUSDT"},
      "QI": {name: "QI", symbol: "QI", decimals: 18, address: addresses.QI, debtCoverage: 0, tradingViewSymbol: "BINANCE:QIUSDT"},
      "PNG": {name: "PNG", symbol: "PNG", logoExt: "png", decimals: 18, address: addresses.PNG, debtCoverage: 0, tradingViewSymbol: "COINBASE:PNGUSD"},
      "PTP": {name: "PTP", symbol: "PTP", logoExt: "png", decimals: 18, address: addresses.PTP, debtCoverage: 0, tradingViewSymbol: "COINEX:PTPUSDT"},
      "BAL": {unsupported: true, name: "BAL", symbol: "BAL", logoExt: "png", decimals: 18, address: addresses.BAL, debtCoverage: 0, tradingViewSymbol: "BINANCE:BALUSDT"},
      "GGP": {unsupported: true, name: "GGP", symbol: "GGP", logoExt: "png", decimals: 18, address: addresses.GGP, debtCoverage: 0, tradingViewSymbol: "TRADERJOE:GGPWAVAX_AE671E.USD"},
    },

    SWAP_DEXS_CONFIG: {
        YakSwap: {
            displayName: 'YakSwap',
            availableAssets: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'EUROC', 'GLP', 'sAVAX', 'GMX', 'JOE', 'QI', 'PNG', 'PTP', 'yyAVAX'],
            slippageMargin: 0.02
        },
        ParaSwapV2: {
            displayName: 'ParaSwap',
            availableAssets: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'sAVAX', 'QI', 'PNG', 'PTP', 'yyAVAX', 'ggAVAX'],
            slippageMargin: 0.05
        },
        GmxV2: {
            availableAssets: [],
            slippageMargin: 0.1
        }
    },
    paraSwapDefaultSlippage: 1,
    showParaSwapWarning: true,
    ASSET_FILTER_TOKENS_OPTIONS: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'sAVAX'],
    ASSET_FILTER_DEXES_OPTIONS: ['Pangolin', 'TraderJoe'],
    NATIVE_ASSET_TOGGLE_OPTIONS: ['AVAX', 'WAVAX'],
    WRAPPED_TOKEN_ADDRESS: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    POOLS_CONFIG: {
        AVAX: {
            address: WAVAX_POOL_TUP.address,
            tokenAddress: addresses.AVAX
        },
        USDC: {
            address: USDC_POOL_TUP.address,
            tokenAddress: addresses.USDC
        },
        USDT: {
            address: USDT_POOL_TUP.address,
            tokenAddress: addresses.USDT
        },
        BTC: {
            address: BTC_POOL_TUP.address,
            tokenAddress: addresses.BTC
        },
        ETH: {
            address: ETH_POOL_TUP.address,
            tokenAddress: addresses.ETH
        }
    },
    LP_ASSETS_CONFIG: {
        "PNG_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDC_LP', decimals: 18, address: addresses.PNG_AVAX_USDC_LP, debtCoverage: 0.83333333333},
        "PNG_AVAX_USDT_LP": { primary: 'USDT', secondary: 'AVAX', name: "AVAX-USDT", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDT_LP', decimals: 18, address: addresses.PNG_AVAX_USDT_LP, debtCoverage: 0.83333333333},
        "PNG_AVAX_ETH_LP": { primary: 'ETH', secondary: 'AVAX', name: "AVAX-ETH", dex: 'Pangolin',  symbol: 'PNG_AVAX_ETH_LP', decimals: 18, address: addresses.PNG_AVAX_ETH_LP, debtCoverage: 0.83333333333},
        "TJ_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDC_LP', decimals: 18, address: addresses.TJ_AVAX_USDC_LP, debtCoverage: 0.83333333333},
        "TJ_AVAX_USDT_LP": { primary: 'USDT', secondary: 'AVAX', name: "AVAX-USDT", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDT_LP', decimals: 18, address: addresses.TJ_AVAX_USDT_LP, debtCoverage: 0.83333333333},
        "TJ_AVAX_ETH_LP": { primary: 'ETH', secondary: 'AVAX', name: "AVAX-ETH", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_ETH_LP', decimals: 18, address: addresses.TJ_AVAX_ETH_LP, debtCoverage: 0.83333333333},
        "TJ_AVAX_BTC_LP": { primary: 'BTC', secondary: 'AVAX', name: "AVAX-BTC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_BTC_LP', decimals: 18, address: addresses.TJ_AVAX_BTC_LP, debtCoverage: 0.83333333333},
        "TJ_AVAX_sAVAX_LP": { primary: 'sAVAX', secondary: 'AVAX', name: "AVAX-sAVAX", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_sAVAX_LP', decimals: 18, address: addresses.TJ_AVAX_sAVAX_LP, debtCoverage: 0.83333333333},
    },
    CONCENTRATED_LP_ASSETS_CONFIG: {
        "SHLB_AVAX-USDC_B": { primary: 'AVAX', secondary: 'USDC', name: "AVAX-USDC", dex: 'SteakHut',  symbol: 'SHLB_AVAX-USDC_B', addMethod: 'stakeSteakHutAVAXUSDC', removeMethod: 'unstakeSteakHutAVAXUSDC', decimals: 18, address: addresses["SHLB_AVAX-USDC_B"], tvl: 180000, debtCoverage: 0.83333333333},
        "SHLB_BTC.b-AVAX_B": { primary: 'BTC', secondary: 'AVAX', name: "BTC.b-AVAX", dex: 'SteakHut',  symbol: 'SHLB_BTC.b-AVAX_B', addMethod: 'stakeSteakHutBTCAVAX', removeMethod: 'unstakeSteakHutBTCAVAX', decimals: 18, address: addresses["SHLB_BTC.b-AVAX_B"], tvl: 44000, debtCoverage: 0.83333333333},
        "SHLB_USDT.e-USDt_C": { inactive: true, primary: 'USDT.e', secondary: 'USDT', name: "USDT.e-USDT", dex: 'SteakHut',  symbol: 'SHLB_USDT.e-USDt_C', addMethod: 'stakeSteakHutUSDTeUSDT', removeMethod: 'unstakeSteakHutUSDTeUSDT', decimals: 18, address: addresses["SHLB_USDT.e-USDt_C"], tvl: 513000, debtCoverage: 0.83333333333},
        "SHLB_EUROC-USDC_V2_1_B": { primary: 'EUROC', secondary: 'USDC', name: "EUROC-USDC", dex: 'SteakHut',  symbol: 'SHLB_EUROC-USDC_V2_1_B', addMethod: 'stakeSteakHutEUROCUSDC', removeMethod: 'unstakeSteakHutEUROCUSDC', decimals: 18, address: addresses["SHLB_EUROC-USDC_V2_1_B"], tvl: 1985000, debtCoverage: 0.83333333333},
    },
    BALANCER_LP_ASSETS_CONFIG: {
        'BAL_sAVAX_AVAX': { primary: 'sAVAX', secondary: 'AVAX', name: 'sAVAX-AVAX', dex: 'Balancer', symbol: 'BAL_sAVAX_AVAX', debtCoverage: 0.83333333333, decimals: 18, tvl: 5350000, address: addresses['BAL_sAVAX_AVAX'], gaugeAddress: addresses['BAL_S_AVAX_MAIN'], rewardTokens: ['QI'], addMethod: 'joinPoolAndStakeBalancerV2', removeMethod: 'unstakeAndExitPoolBalancerV2', gaugeBalanceMethod: 'balancerSAvaxBalance', poolId: '0xfd2620c9cfcec7d152467633b3b0ca338d3d78cc00000000000000000000001c'},
        'BAL_yyAVAX_AVAX': { primary: 'AVAX', secondary: 'yyAVAX', name: 'yyAVAX-AVAX', reverseOrder: true, dex: 'Balancer', symbol: 'BAL_yyAVAX_AVAX', debtCoverage: 0.83333333333, decimals: 18, tvl: 1680000, address: addresses['BAL_yyAVAX_AVAX'], gaugeAddress: addresses['BAL_YY_AVAX_MAIN'], rewardTokens: [], addMethod: 'joinPoolAndStakeBalancerV2', removeMethod: 'unstakeAndExitPoolBalancerV2', gaugeBalanceMethod: 'balancerYyAvaxBalance', poolId: '0x9fa6ab3d78984a69e712730a2227f20bcc8b5ad900000000000000000000001f', firstOfTokensIsPool: true},
        'BAL_ggAVAX_AVAX': { primary: 'ggAVAX', secondary: 'AVAX', name: 'ggAVAX-AVAX', dex: 'Balancer', symbol: 'BAL_ggAVAX_AVAX', debtCoverage: 0.83333333333, decimals: 18, tvl: 3700000, address: addresses['BAL_ggAVAX_AVAX'], gaugeAddress: addresses['BAL_GG_AVAX_MAIN'], rewardTokens: ['GGP'], addMethod: 'joinPoolAndStakeBalancerV2', removeMethod: 'unstakeAndExitPoolBalancerV2', gaugeBalanceMethod: 'balancerGgAvaxBalance', poolId: '0xc13546b97b9b1b15372368dc06529d7191081f5b00000000000000000000001d'}
    },
    TRADERJOEV2_LP_ASSETS_CONFIG: {
        'TJLB_AVAX-USDC': { primary: 'AVAX', secondary: 'USDC', name: 'AVAX-USDC', dex: 'TraderJoe', symbol: 'TJLB_AVAX-USDC', debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.002', address: addresses['TJLB_AVAX-USDC'], binStep: 20, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: "https://traderjoexyz.com/avalanche/pool/v21/AVAX/0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e/20"},
        'TJLB_ETH-AVAX': { primary: 'ETH', secondary: 'AVAX', name: 'ETH-AVAX', dex: 'TraderJoe', symbol: 'TJLB_ETH-AVAX', debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.001', address: addresses['TJLB_ETH-AVAX'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: 'https://traderjoexyz.com/avalanche/pool/v21/0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab/AVAX/10'},
        'TJLB_BTC.b-AVAX': { primary: 'BTC', secondary: 'AVAX', name: 'BTC-AVAX', dex: 'TraderJoe', symbol: 'TJLB_BTCB-AVAX', debtCoverage: 0.83333333333, decimals: 18, baseFee: '0.1', address: addresses['TJLB_BTC.b-AVAX'], binStep: 10, addMethod: 'addLiquidityTraderJoeV2', removeMethod: 'removeLiquidityTraderJoeV2', link: 'https://traderjoexyz.com/avalanche/pool/v21/0x152b9d0fdc40c096757f570a51e494bd4b943e50/AVAX/10'},
    },
    LEVEL_LP_ASSETS_CONFIG: {},
    GMX_V2_ASSETS_CONFIG: {
        "GM_AVAX_WAVAX_USDC": {name: "AVAX-USDC", symbol: "GM_AVAX_WAVAX_USDC", short: "GM", decimals: 18, address: addresses.GM_AVAX_WAVAX_USDC, debtCoverage: 0.83333333333, longToken: 'AVAX', shortToken: 'USDC', indexTokenAddress: addresses.AVAX, link: 'https://app.gmx.io/#/stats'},
        "GM_BTC_BTCb_USDC": {name: "BTC-USDC", symbol: "GM_BTC_BTCb_USDC", logoExt: "png", short: "GM", decimals: 18, address: addresses.GM_BTC_BTCb_USDC, debtCoverage: 0.83333333333, longToken: 'BTC', shortToken: 'USDC', indexTokenAddress: addresses.BTC, link: 'https://app.gmx.io/#/stats'},
        "GM_ETH_WETHe_USDC": {name: "ETH-USDC", symbol: "GM_ETH_WETHe_USDC", short: "GM", decimals: 18, address: addresses.GM_ETH_WETHe_USDC, debtCoverage: 0.83333333333, longToken: 'ETH', shortToken: 'USDC', indexTokenAddress: addresses.ETH, link: 'https://app.gmx.io/#/stats'},
    },
    maxTraderJoeV2Bins: 80,
    DEX_CONFIG: {
        'Pangolin': {
            intermediaryAddress: PANGOLIN_INTERMEDIARY_TUP.address,
            routerAddress: '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106',
            swapMethod: 'swapPangolin',
            addLiquidityMethod: 'addLiquidityPangolin',
            removeLiquidityMethod: 'removeLiquidityPangolin',
            logo: 'png.png'
        },
        'TraderJoe': {
            intermediaryAddress: TRADERJOE_INTERMEDIARY_TUP.address,
            routerAddress: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
            addLiquidityMethod: 'addLiquidityTraderJoe',
            removeLiquidityMethod: 'removeLiquidityTraderJoe',
            logo: 'joe.png'
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
                autoCompounding: true,
                protocolIdentifier: 'YY_AAVE_AVAX',
                balance: async (address) => yieldYakBalance('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakingContractAddress: '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeAVAXYak',
                unstakeMethod: 'unstakeAVAXYak',
                feedSymbol: 'YY_AAVE_AVAX',
                symbol: 'YRT',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Repeatedly lends and borrows AVAX on Aave to optimize rewards.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['AVAX'],
                strategy: 'AAVE',
                refreshDelay: 60000
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_AVAX_SAVAX',
                balance: async (address) => vectorFinanceBalance('0xab42ed09F43DDa849aa7F62500885A973A38a8Bc', address),
                stakingContractAddress: '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc',
                receiptTokenAddress: '0x25dd42103b7da808e68a2bae5e14f48871488a85',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeWAVAX1',
                unstakeMethod: 'vectorUnstakeWAVAX1',
                migrateMethod: 'vectorMigrateAvax',
                migrateToProtocolIdentifier: 'VF_AVAX_SAVAX_AUTO',
                minAmount: 0.8,
                symbol: 'V-WAVAX-R',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000,
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_AVAX_SAVAX_AUTO',
                autoCompounding: true,
                stakingContractAddress: '0xe2406Af0E26769D3231682C80D4bB7bBdF329A88',
                decimals: 18, //decimals of staking contract
                balanceMethod: 'vectorWAVAX1BalanceAuto',
                stakeMethod: 'vectorStakeWAVAX1Auto',
                unstakeMethod: 'vectorUnstakeWAVAX1Auto',
                minAmount: 0.8,
                symbol: 'AVAX_SAVAX ACR',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            }
        ],
        sAVAX: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_PTP_sAVAX',
                autoCompounding: true,
                balance: async (address) => yieldYakBalance('0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977', address),
                stakingContractAddress: '0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeSAVAXYak',
                unstakeMethod: 'unstakeSAVAXYak',
                feedSymbol: 'YY_PTP_sAVAX',
                symbol: 'YRT',
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Yield Yak strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0,
                rewardTokens: ['sAVAX'],
                strategy: 'Platypus',
                banner: 'Due to the recent Platypus exploit, deposits in their farms have been disabled.',
                refreshDelay: 60000
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_SAVAX_MAIN',
                balance: (address) => vectorFinanceBalance('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', address),
                stakingContractAddress: '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7',
                receiptTokenAddress: '0x8aa347d9a2bb8e32342f50939236251853604c79',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeSAVAX1',
                unstakeMethod: 'vectorUnstakeSAVAX1',
                migrateMethod: 'vectorMigrateSAvax',
                migrateToProtocolIdentifier: 'VF_SAVAX_MAIN_AUTO',
                minAmount: 0.8,
                symbol: 'V-SAVAX-R',
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_SAVAX_MAIN_AUTO',
                autoCompounding: true,
                balance: (address) => vectorFinanceBalance('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', address),
                stakingContractAddress: '0x1636bE3843E86826cB6aDC141B5d40d782763B85',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeSAVAX1Auto',
                unstakeMethod: 'vectorUnstakeSAVAX1Auto',
                minAmount: 0.8,
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            }
        ],
        USDC: [
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_USDC_MAIN',
                balance: (address) => vectorFinanceBalance('0xE5011Ab29612531727406d35cd9BcCE34fAEdC30', address, 6),
                stakingContractAddress: '0xE5011Ab29612531727406d35cd9BcCE34fAEdC30',
                receiptTokenAddress: '0x0adab2f0455987098059cfc10875c010800c659f',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeUSDC1',
                unstakeMethod: 'vectorUnstakeUSDC1',
                info: 'Depositing into Platypus\' main pool has been temporarily disabled. Read more in our <a href="https://discord.com/invite/9bwsnsHEzD" target="_blank">discord</a>.',
                minAmount: 0.8,
                symbol: 'V USDC-LP',
                token: 'USDC',
                isTokenLp: false,
                debtCoverage: 0,
                rewardTokens: ['PTP'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_USDC_MAIN_AUTO',
                autoCompounding: true,
                stakingContractAddress: '0x1DBd41f9Efde5b387E820e9B43BDa00c4154a82A',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeUSDC1Auto',
                unstakeMethod: 'vectorUnstakeUSDC1Auto',
                balanceMethod: 'vectorUSDC1BalanceAuto',
                minAmount: 0.8,
                symbol: 'USDC ACR',
                token: 'USDC',
                isTokenLp: false,
                debtCoverage: 0,
                rewardTokens: ['PTP'],
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
        ],
        USDT: [
            {
                protocol: 'VECTOR_FINANCE',
                protocolIdentifier: 'VF_USDT_MAIN_AUTO',
                autoCompounding: true,
                stakingContractAddress: '0x951CbF0DDA285FD8011F2cB7Ed435fA095f803a0',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'vectorStakeUSDT1Auto',
                unstakeMethod: 'vectorUnstakeUSDT1Auto',
                balanceMethod: 'vectorUSDT1BalanceAuto',
                minAmount: 0.9,
                symbol: 'USDT ACR',
                token: 'USDT',
                isTokenLp: false,
                debtCoverage: 0,
                strategy: 'Platypus',
                banner: 'This farm is disabled and underlying assets were returned to your Prime Account.',
                refreshDelay: 60000
            },
        ],
        GLP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_GLP',
                autoCompounding: true,
                balance: async (address) => yieldYakBalance('0x9f637540149f922145c06e1aa3f38dcDc32Aff5C', address),
                stakingContractAddress: '0x9f637540149f922145c06e1aa3f38dcDc32Aff5C',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeGLPYak',
                unstakeMethod: 'unstakeGLPYak',
                feedSymbol: 'YY_GLP',
                symbol: 'YRT',
                token: 'GLP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: false,
                debtCoverage: 0.83333333333,
                strategy: 'GMX',
                rewardTokens: ['GLP'],
                refreshDelay: 60000
            },
        ],
        PNG_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_PNG_AVAX_USDC_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656', address),
                stakingContractAddress: '0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakePNGAVAXUSDCYak',
                unstakeMethod: 'unstakePNGAVAXUSDCYak',
                feedSymbol: 'YY_PNG_AVAX_USDC_LP',
                symbol: 'YRT',
                token: 'PNG_AVAX_USDC_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'Pangolin',
                refreshDelay: 60000,
            }
        ],
        PNG_AVAX_ETH_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_PNG_AVAX_ETH_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0xFCD2050E213cC54db2c9c99632AC870574FbC261', address),
                stakingContractAddress: '0xFCD2050E213cC54db2c9c99632AC870574FbC261',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakePNGAVAXETHYak',
                unstakeMethod: 'unstakePNGAVAXETHYak',
                feedSymbol: 'YY_PNG_AVAX_ETH_LP',
                symbol: 'YRT',
                token: 'PNG_AVAX_ETH_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'Pangolin',
                refreshDelay: 60000,
            }
        ],
        TJ_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_TJ_AVAX_USDC_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC', address),
                stakingContractAddress: '0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeTJAVAXUSDCYak',
                unstakeMethod: 'unstakeTJAVAXUSDCYak',
                feedSymbol: 'YY_TJ_AVAX_USDC_LP',
                symbol: 'YRT',
                token: 'TJ_AVAX_USDC_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'TraderJoe',
                refreshDelay: 60000
            }
        ],
        TJ_AVAX_ETH_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_TJ_AVAX_ETH_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0x5219558ee591b030E075892acc41334A1694fd8A', address),
                stakingContractAddress: '0x5219558ee591b030E075892acc41334A1694fd8A',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeTJAVAXETHYak',
                unstakeMethod: 'unstakeTJAVAXETHYak',
                feedSymbol: 'YY_TJ_AVAX_ETH_LP',
                symbol: 'YRT',
                token: 'TJ_AVAX_ETH_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'TraderJoe',
                refreshDelay: 60000
            }
        ],
        TJ_AVAX_sAVAX_LP: [
            {
                protocol: 'YIELD_YAK',
                protocolIdentifier: 'YY_TJ_AVAX_sAVAX_LP',
                autoCompounding: true,
                balance: (address) => yieldYakBalance('0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56', address),
                stakingContractAddress: '0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56',
                decimals: 18, //decimals of staking contract
                stakeMethod: 'stakeTJAVAXSAVAXYak',
                unstakeMethod: 'unstakeTJAVAXSAVAXYak',
                feedSymbol: 'YY_TJ_AVAX_sAVAX_LP',
                symbol: 'YRT',
                token: 'TJ_AVAX_sAVAX_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'TraderJoe',
                refreshDelay: 60000,
                banner: 'Rewards for this farm have been turned off, removing compounding benefits. Therefore, depositing into this farm has been disabled.'
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
    yakRouterAddress: '0xC4729E56b831d74bBc18797e0e17A295fA77488c',
    yakWrapRouterAddress: '0x44f4737C3Bb4E5C1401AE421Bd34F135E0BB8394',
    yieldYakGlpWrapperAddress: '0x442DB6e78e54449B2a5f08A943Fa8a79041C797b',
    glpRewardsRouterAddress: '0x82147C5A7E850eA4E28155DF107F2590fD4ba327',
    depositSwapAddress: "0xa0170E529f94C955f77Fcf14F57C7A7cDf0FDb71",
    gmxV2ReaderAddress: "0x73BA021ACF4Bb6741E82690DdB821e7936050f8C",
    gmxV2DataStoreAddress: "0x2F0b22339414ADeD7D5F06f9D604c7fF5b2fe3f6",
    gmxV2HighExecutionFee: 0,
    gmxV2DepositCallbackGasLimit: 300000,
    gmxV2WithdrawalCallbackGasLimit: 300000,
    gmxV2GasPriceBuffer: 0.1,
    gmxV2GasPricePremium: 3000000000,
    gmxV2UseMaxPriorityFeePerGas: true,
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod",
    dataProviderHistoricalPrices: "redstone-avalanche",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-avalanche-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/deltaprime",
    readRpcUrl: "https://avalanche-mainnet.core.chainstack.com/ext/bc/C/rpc/0968db18a01a90bac990ff00df6f7da1",
    fallbackRpcs: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://ava-mainnet.public.blastapi.io/ext/bc/C/rpc',
      'https://avax.meowrpc.com',
    ],
    multicallAddress: "0x271BcC10126A0B94EC5FaFf0B4f39A50fC4AC117",
    EMAIL_REGEX: /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/,
    refreshDelay: 5000,
    gmxV2RefreshDelay: 10000,
    gmxV2IncentivesMilestone: 21000000,
    gmxV2IncentivesDeadline: 'March 3rd',
    historicalRpcUrl: "https://nd-875-171-632.p2pify.com/1e4e4e399220d21d56677b5be69f9326/ext/bc/C/rpc",
}
