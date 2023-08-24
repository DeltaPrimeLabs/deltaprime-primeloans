import addresses from '../common/addresses/arbitrum/token_addresses.json';
import USDC_POOL_TUP from '/deployments/arbitrum/UsdcPoolTUP.json';
import USDT_POOL_TUP from '/deployments/arbitrum/UsdtPoolTUP.json';
import WETH_POOL_TUP from '/deployments/arbitrum/WethPoolTUP.json';
import DAI_POOL_TUP from '/deployments/arbitrum/DaiPoolTUP.json';
import FRAX_POOL_TUP from '/deployments/arbitrum/FraxPoolTUP.json';
import LINK_POOL_TUP from '/deployments/arbitrum/LinkPoolTUP.json';
import UNI_POOL_TUP from '/deployments/arbitrum/UniPoolTUP.json';
import PANGOLIN_INTERMEDIARY_TUP from '../deployments/avalanche/PangolinIntermediaryTUP.json';
import TRADERJOE_INTERMEDIARY_TUP from '../deployments/avalanche/TraderJoeIntermediaryTUP.json';
import {vectorFinanceBalance, yieldYakBalance} from './utils/calculate';

export default {
    MIN_ALLOWED_HEALTH: 0.0182,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    chainId: 42161,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333},
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333},
      "USDT": {name: "USDT", symbol: "USDT", decimals: 6, address: addresses.USDT, isStableCoin: true, debtCoverage: 0.83333333333},
      "DAI": {name: "DAI", symbol: "DAI", logoExt: "png", decimals: 18, isStableCoin: true, address: addresses.DAI, debtCoverage: 0.83333333333},
      "FRAX": {name: "FRAX", symbol: "FRAX", decimals: 18, isStableCoin: true, address: addresses.FRAX, debtCoverage: 0.83333333333},
      "UNI": {name: "UNI", symbol: "UNI", logoExt: "png", decimals: 18, address: addresses.UNI, debtCoverage: 0.83333333333},
      "LINK": {name: "LINK", symbol: "LINK", decimals: 18, address: addresses.LINK, debtCoverage: 0.83333333333},
      "ARB": {name: "ARB", symbol: "ARB", logoExt: "png", decimals: 18, address: addresses.ARB, debtCoverage: 0.83333333333},
      "GMX": {name: "GMX", symbol: "GMX", logoExt: "png", decimals: 18, address: addresses.GMX, debtCoverage: 0.83333333333},
      "GLP": {name: "GLP", symbol: "GLP", logoExt: "png", decimals: 18, address: addresses.GLP, debtCoverage: 0.83333333333},
      "WSTETH": {name: "WSTETH", symbol: "WSTETH", logoExt: "png", decimals: 18, address: addresses.WSTETH, debtCoverage: 0.83333333333},
    },
    AVAILABLE_ASSETS_PER_DEX: {
        YakSwap: ['ETH', 'USDC', 'USDT', 'ARB', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'WSTETH'],
        ParaSwap: ['ETH', 'USDC', 'USDT', 'ARB', 'GMX', 'GLP', 'DAI', 'FRAX', 'LINK', 'UNI', 'WSTETH']
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
        USDT: {
            address: USDT_POOL_TUP.address,
            tokenAddress: addresses.USDT
        },
        ETH: {
            address: WETH_POOL_TUP.address,
            tokenAddress: addresses.ETH
        },
        DAI: {
            address: DAI_POOL_TUP.address,
            tokenAddress: addresses.DAI
        },
        FRAX: {
            address: FRAX_POOL_TUP.address,
            tokenAddress: addresses.FRAX
        },
        // LINK: {
        //     address: LINK_POOL_TUP.address,
        //     tokenAddress: addresses.LINK
        // },
        UNI: {
            address: UNI_POOL_TUP.address,
            tokenAddress: addresses.UNI
        }
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
        VECTOR_FINANCE: {
            logo: 'vector.png',
            name: 'Vector Finance'
        },
    },
    FARMED_TOKENS_CONFIG: {},

    yakRouterAddress: '0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3',
    yakWrapRouterAddress: '0x16f90031000d48ce2bc6577788282c232060c547',
    yieldYakGlpWrapperAddress: '0x5190B15497e5EC8Fb94eFac4ebd8B089645F68c2',
    glpRewardsRouterAddress: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1', //TODO: needs testing
    nativeToken: "ETH",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-arbitrum-prod",
    redstoneFeedUrl: "https://oracle-gateway-2.a.redstone.finance/data-packages/latest/redstone-arbitrum-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/deltaprime"
}
