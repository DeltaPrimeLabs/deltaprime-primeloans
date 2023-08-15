import addresses from '../common/addresses/arbitrum/token_addresses.json';
import USDC_POOL_TUP from '/deployments/arbitrum/UsdcPoolTUP.json';
import WETH_POOL_TUP from '/deployments/arbitrum/WethPoolTUP.json';

export default {
    MIN_ALLOWED_HEALTH: 0.0182,
    DECIMALS_PRECISION: 8,
    MAX_BUTTON_MULTIPLIER: 1.01,
    TRANSACTION_HISTORY_PAGE_SIZE: 7,
    chainId: 42161,
    //update leverage after every change in contracts
    ASSETS_CONFIG: {
      "USDC": {name: "USDC", symbol: "USDC", decimals: 6, address: addresses.USDC, isStableCoin: true, debtCoverage: 0.83333333333},
      "ETH": {name: "ETH", symbol: "ETH", decimals: 18, address: addresses.ETH, debtCoverage: 0.83333333333},
    },
    AVAILABLE_ASSETS_PER_DEX: {
        YakSwap: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'USDT.e', 'EUROC', 'GLP', 'sAVAX', 'GMX', 'JOE', 'QI', 'PNG', 'PTP'],
        ParaSwap: ['AVAX', 'USDC', 'BTC', 'ETH', 'USDT', 'USDT.e', 'sAVAX', 'QI', 'PNG', 'PTP']
    },
    POOLS_CONFIG: {
        USDC: {
            address: USDC_POOL_TUP.address,
            tokenAddress: addresses.USDC
        },
        ETH: {
            address: WETH_POOL_TUP.address,
            tokenAddress: addresses.ETH
        }
    },

    yakRouterAddress: '0xC4729E56b831d74bBc18797e0e17A295fA77488c',
    yakWrapRouterAddress: '0x44f4737C3Bb4E5C1401AE421Bd34F135E0BB8394',
    yieldYakGlpWrapperAddress: '0x442DB6e78e54449B2a5f08A943Fa8a79041C797b',
    glpRewardsRouterAddress: '0x82147C5A7E850eA4E28155DF107F2590fD4ba327',
    nativeToken: "ETH",
    SLIPPAGE_TOLERANCE: 0.03,
    dataProviderId: "redstone-avalanche-prod",
    subgraph: "https://api.thegraph.com/subgraphs/name/mbare0/deltaprime"
}
