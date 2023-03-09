import addresses from '../common/addresses/avax/token_addresses.json';
import {
    getPangolinLpApr, getTraderJoeLpApr,
    vectorFinanceApy,
    vectorFinanceBalance,
    yieldYakApy,
    yieldYakBalance
} from "./utils/calculate";
import WAVAX_POOL_TUP from '@contracts/WavaxPoolTUP.json';
import USDC_POOL_TUP from '@contracts/UsdcPoolTUP.json';
import BTC_POOL_TUP from '@contracts/BtcPoolTUP.json';
import ETH_POOL_TUP from '@contracts/EthPoolTUP.json';
import PANGOLIN_INTERMEDIARY_TUP from '@contracts/PangolinIntermediaryTUP.json';
import TRADERJOE_INTERMEDIARY_TUP from '@contracts/TraderJoeIntermediaryTUP.json';
import {glpApy} from "./utils/blockchain";

export default {
    MAX_COLLATERAL: 500,
    MIN_ALLOWED_HEALTH: 0.0182,
    COMPETITION_START_BLOCK: 14858534,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    chainId: 43114,
    // chainId: 1337,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "AVAX": {name: "AVAX", symbol: "AVAX", decimals: 18, address: addresses.AVAX, debtCoverage: 0.83333333333},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333},
      "BTC": {name: "BTC", symbol: "BTC", decimals: 8, address: addresses.BTC, debtCoverage: 0.83333333333},
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333, getApy: glpApy, swappableAssets: ['BTC', 'ETH', 'USDC']},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333},
      "sAVAX": {name: "sAVAX", symbol: "sAVAX", decimals: 18, address: addresses.sAVAX, debtCoverage: 0.83333333333, apy: 7.2},
      "QI": {name: "QI", symbol: "QI", decimals: 18, address: addresses.QI, debtCoverage: 0},
      "PNG": {name: "PNG", symbol: "PNG", logoExt: "png", decimals: 18, address: addresses.PNG, debtCoverage: 0},
      "PTP": {name: "PTP", symbol: "PTP", logoExt: "png", decimals: 18, address: addresses.PTP, debtCoverage: 0},
    },
    POOLS_CONFIG: {
        AVAX: {
            address: WAVAX_POOL_TUP.address,
            tokenAddress: addresses.AVAX
        },
        USDC: {
            address: USDC_POOL_TUP.address,
            tokenAddress: addresses.USDC
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
        "PNG_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDC_LP', decimals: 18, address: addresses.PNG_AVAX_USDC_LP, debtCoverage: 0.83333333333, getApy: () => getPangolinLpApr('https://api.pangolin.exchange/pangolin/apr2/55')},
        "PNG_AVAX_USDT_LP": { primary: 'USDT', secondary: 'AVAX', name: "AVAX-USDT", dex: 'Pangolin',  symbol: 'PNG_AVAX_USDT_LP', decimals: 18, address: addresses.PNG_AVAX_USDT_LP, debtCoverage: 0.83333333333, getApy: () => getPangolinLpApr('https://api.pangolin.exchange/pangolin/apr2/113')},
        "PNG_AVAX_ETH_LP": { primary: 'ETH', secondary: 'AVAX', name: "AVAX-ETH", dex: 'Pangolin',  symbol: 'PNG_AVAX_ETH_LP', decimals: 18, address: addresses.PNG_AVAX_ETH_LP, debtCoverage: 0.83333333333, getApy: () => getPangolinLpApr('https://api.pangolin.exchange/pangolin/apr2/9')},
        "TJ_AVAX_USDC_LP": { primary: 'USDC', secondary: 'AVAX', name: "AVAX-USDC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDC_LP', decimals: 18, address: addresses.TJ_AVAX_USDC_LP, debtCoverage: 0.83333333333, getApy: () => getTraderJoeLpApr(addresses.TJ_AVAX_USDC_LP)},
        "TJ_AVAX_USDT_LP": { primary: 'USDT', secondary: 'AVAX', name: "AVAX-USDT", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_USDT_LP', decimals: 18, address: addresses.TJ_AVAX_USDT_LP, debtCoverage: 0.83333333333, getApy: () => getTraderJoeLpApr(addresses.TJ_AVAX_USDT_LP)},
        "TJ_AVAX_ETH_LP": { primary: 'ETH', secondary: 'AVAX', name: "AVAX-ETH", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_ETH_LP', decimals: 18, address: addresses.TJ_AVAX_ETH_LP, debtCoverage: 0.83333333333, getApy: () => getTraderJoeLpApr(addresses.TJ_AVAX_ETH_LP)},
        "TJ_AVAX_BTC_LP": { primary: 'BTC', secondary: 'AVAX', name: "AVAX-BTC", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_BTC_LP', decimals: 18, address: addresses.TJ_AVAX_BTC_LP, debtCoverage: 0.83333333333, getApy: () => getTraderJoeLpApr(addresses.TJ_AVAX_BTC_LP)},
        "TJ_AVAX_sAVAX_LP": { primary: 'sAVAX', secondary: 'AVAX', name: "AVAX-sAVAX", dex: 'TraderJoe', addMethod: 'addLiquidityTraderJoe', removeMethod: 'removeLiquidityTraderJoe',symbol: 'TJ_AVAX_sAVAX_LP', decimals: 18, address: addresses.TJ_AVAX_sAVAX_LP, debtCoverage: 0.83333333333, getApy: () => getTraderJoeLpApr(addresses.TJ_AVAX_sAVAX_LP, 3.6)},
    },
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
            swapMethod: 'swapTraderJoe',
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
                apy: async () => yieldYakApy('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95'),
                balance: async (address) => yieldYakBalance('0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95', address),
                stakingContractAddress: '0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95',
                stakeMethod: 'stakeAVAXYak',
                unstakeMethod: 'unstakeAVAXYak',
                feedSymbol: 'YY_AAVE_AVAX',
                token: 'AVAX',
                isTokenLp: false,
                info: 'Repeatedly lends and borrows AVAX on Aave to optimize rewards.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['AVAX'],
                strategy: 'AAVE',
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
            },
            {
                protocol: 'VECTOR_FINANCE',
                apy: async () => vectorFinanceApy('AVAX'),
                balance: async (address) => vectorFinanceBalance('0xab42ed09F43DDa849aa7F62500885A973A38a8Bc', address),
                stakingContractAddress: '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc',
                stakeMethod: 'vectorStakeWAVAX1',
                unstakeMethod: 'vectorUnstakeWAVAX1',
                minAmount: 0.8,
                token: 'AVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000,
                showMigrateButton: true,
            },
            {
                protocol: 'VECTOR_FINANCE',
                autoCompounding: true,
                apy: async () => vectorFinanceApy('AVAX'),
                balance: async (address) => vectorFinanceBalance('0xab42ed09F43DDa849aa7F62500885A973A38a8Bc', address),
                stakingContractAddress: '0xab42ed09F43DDa849aa7F62500885A973A38a8Bc',
                stakeMethod: 'vectorStakeWAVAX1Auto',
                unstakeMethod: 'vectorUnstakeWAVAX1Auto',
                minAmount: 0.8,
                token: 'AVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            }
        ],
        sAVAX: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                apy: async () => yieldYakApy('0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977'),
                balance: async (address) => yieldYakBalance('0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977', address),
                stakingContractAddress: '0xb8f531c0d3c53B1760bcb7F57d87762Fd25c4977',
                stakeMethod: 'stakeSAVAXYak',
                unstakeMethod: 'unstakeSAVAXYak',
                feedSymbol: 'YY_PTP_sAVAX',
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Yield Yak strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['sAVAX'],
                strategy: 'Platypus',
                refreshDelay: 60000,
                gasStake: 6000000,
                gasUnstake: 6000000
            },
            {
                protocol: 'VECTOR_FINANCE',
                apy: () => vectorFinanceApy('SAVAX'),
                balance: (address) => vectorFinanceBalance('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', address),
                stakingContractAddress: '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7',
                stakeMethod: 'vectorStakeSAVAX1',
                unstakeMethod: 'vectorUnstakeSAVAX1',
                minAmount: 0.8,
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Deposit/withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000,
                showMigrateButton: true,
            },
            {
                protocol: 'VECTOR_FINANCE',
                autoCompounding: true,
                apy: () => vectorFinanceApy('SAVAX'),
                balance: (address) => vectorFinanceBalance('0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7', address),
                stakingContractAddress: '0x91F78865b239432A1F1Cc1fFeC0Ac6203079E6D7',
                stakeMethod: 'vectorStakeSAVAX1',
                unstakeMethod: 'vectorUnstakeSAVAX1',
                minAmount: 0.8,
                token: 'sAVAX',
                isTokenLp: false,
                info: 'Uses Vector Finance strategy on Platypus. Withdrawal fees may apply. Check <a href="https://docs.platypus.finance/platypus-finance-docs/our-innovative-concepts/fees/withdrawal-fee" target="_blank">docs</a>.',
                debtCoverage: 0.83333333333,
                rewardTokens: ['PTP', 'QI'],
                strategy: 'Platypus',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            }
        ],
        USDC: [
            {
                protocol: 'VECTOR_FINANCE',
                //TODO: check if it's a right APY
                apy: () => vectorFinanceApy('USDC'),
                balance: (address) => vectorFinanceBalance('0xE5011Ab29612531727406d35cd9BcCE34fAEdC30', address, 6),
                stakingContractAddress: '0xE5011Ab29612531727406d35cd9BcCE34fAEdC30',
                stakeMethod: 'vectorStakeUSDC1',
                unstakeMethod: 'vectorUnstakeUSDC1',
                info: 'Depositing into Platypus\' main pool has been temporarily disabled. Read more in our <a href="https://discord.com/invite/9bwsnsHEzD" target="_blank">discord</a>.',
                minAmount: 0.8,
                token: 'USDC',
                isTokenLp: false,
                debtCoverage: 0,
                rewardTokens: ['PTP'],
                strategy: 'Platypus',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            },
        ],
        GLP: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                //TODO: check if it's a right APY
                apy: () => yieldYakApy('0x9f637540149f922145c06e1aa3f38dcDc32Aff5C'),
                balance: async (address) => yieldYakBalance('0x9f637540149f922145c06e1aa3f38dcDc32Aff5C', address),
                stakingContractAddress: '0x9f637540149f922145c06e1aa3f38dcDc32Aff5C',
                stakeMethod: 'stakeGLPYak',
                unstakeMethod: 'unstakeGLPYak',
                feedSymbol: 'YY_GLP',
                token: 'GLP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: false,
                debtCoverage: 0.83333333333,
                strategy: 'GMX',
                rewardTokens: ['GLP'],
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            },
        ],
        PNG_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                apy: () => yieldYakApy('0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656'),
                balance: (address) => yieldYakBalance('0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656', address),
                stakingContractAddress: '0xC0cd58661b68e10b49D3Bec4bC5E44e7A7c20656',
                stakeMethod: 'stakePNGAVAXUSDCYak',
                unstakeMethod: 'unstakePNGAVAXUSDCYak',
                feedSymbol: 'YY_PNG_AVAX_USDC_LP',
                token: 'PNG_AVAX_USDC_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'Pangolin',
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
            }
        ],
        PNG_AVAX_ETH_LP: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                apy: () => yieldYakApy('0xFCD2050E213cC54db2c9c99632AC870574FbC261'),
                balance: (address) => yieldYakBalance('0xFCD2050E213cC54db2c9c99632AC870574FbC261', address),
                stakingContractAddress: '0xFCD2050E213cC54db2c9c99632AC870574FbC261',
                stakeMethod: 'stakePNGAVAXETHYak',
                unstakeMethod: 'unstakePNGAVAXETHYak',
                feedSymbol: 'YY_PNG_AVAX_ETH_LP',
                token: 'PNG_AVAX_ETH_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'Pangolin',
                refreshDelay: 60000,
                gasStake: 4000000,
                gasUnstake: 4000000
            }
        ],
        TJ_AVAX_USDC_LP: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                apy: () => yieldYakApy('0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC'),
                balance: (address) => yieldYakBalance('0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC', address),
                stakingContractAddress: '0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC',
                stakeMethod: 'stakeTJAVAXUSDCYak',
                unstakeMethod: 'unstakeTJAVAXUSDCYak',
                feedSymbol: 'YY_TJ_AVAX_USDC_LP',
                token: 'TJ_AVAX_USDC_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'TraderJoe',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            }
        ],
        TJ_AVAX_ETH_LP: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                apy: () => yieldYakApy('0x5219558ee591b030E075892acc41334A1694fd8A'),
                balance: (address) => yieldYakBalance('0x5219558ee591b030E075892acc41334A1694fd8A', address),
                stakingContractAddress: '0x5219558ee591b030E075892acc41334A1694fd8A',
                stakeMethod: 'stakeTJAVAXETHYak',
                unstakeMethod: 'unstakeTJAVAXETHYak',
                feedSymbol: 'YY_TJ_AVAX_ETH_LP',
                token: 'TJ_AVAX_ETH_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'TraderJoe',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            }
        ],
        TJ_AVAX_sAVAX_LP: [
            {
                protocol: 'YIELD_YAK',
                autoCompounding: true,
                apy: () => yieldYakApy('0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56'),
                balance: (address) => yieldYakBalance('0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56', address),
                stakingContractAddress: '0x22EDe03f1115666CF05a4bAfafaEe8F43D42cD56',
                stakeMethod: 'stakeTJAVAXSAVAXYak',
                unstakeMethod: 'unstakeTJAVAXSAVAXYak',
                feedSymbol: 'YY_TJ_AVAX_sAVAX_LP',
                token: 'TJ_AVAX_sAVAX_LP',
                rewardsInfo: 'These are the rewards that you accumulated. These are staked too.',
                isTokenLp: true,
                debtCoverage: 0.83333333333,
                strategy: 'TraderJoe',
                refreshDelay: 60000,
                gasStake: 8000000,
                gasUnstake: 8000000
            }
        ],
    },
    yakRouterAddress: '0xC4729E56b831d74bBc18797e0e17A295fA77488c',
    yakWrapRouterAddress: '0x44f4737C3Bb4E5C1401AE421Bd34F135E0BB8394',
    yieldYakGlpWrapperAddress: '0xe663d083b849d1f22ef2778339ec58175f547608',
    glpRewardsRouterAddress: '0x82147C5A7E850eA4E28155DF107F2590fD4ba327',
    nativeToken: "AVAX",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/deltaprime"
}
