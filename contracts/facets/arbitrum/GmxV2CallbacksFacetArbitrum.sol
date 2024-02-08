// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8922f5facddf72a172d7cd2dc5c648be3d62ff3d;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2CallbacksFacet.sol";

contract GmxV2CallbacksFacetArbitrum is GmxV2CallbacksFacet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/arbitrum/
    // GMX contracts

    function getGmxV2RoleStore() internal pure virtual override returns (address){
        return 0x3c3d99FD298f679DBC2CEcd132b4eC4d0F5e6e72;
    }

    // Markets
    address constant GM_ETH_WETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address constant GM_ARB_ARB_USDC = 0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407;
    address constant GM_LINK_LINK_USDC = 0x7f1fa204bb700853D36994DA19F830b6Ad18455C;
    address constant GM_UNI_UNI_USDC = 0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50;
    address constant GM_BTC_WBTC_USDC = 0x47c031236e19d024b42f8AE6780E44A573170703;

    // Tokens
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    address constant LINK = 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4;
    address constant UNI = 0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0;
    address constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;

    // Mappings
    function marketToLongToken(address market) internal override pure returns (address){
        if(market == GM_ETH_WETH_USDC){
            return WETH;
        } else if (market == GM_ARB_ARB_USDC){
            return ARB;
        } else if (market == GM_LINK_LINK_USDC){
            return LINK;
        } else if (market == GM_UNI_UNI_USDC){
            return UNI;
        } else if (market == GM_BTC_WBTC_USDC){
            return WBTC;
        }else {
            revert("Market not supported");
        }
    }

    function marketToShortToken(address market) internal override pure returns (address){
        if(market == GM_ETH_WETH_USDC){
            return USDC;
        } else if (market == GM_ARB_ARB_USDC){
            return USDC;
        } else if (market == GM_LINK_LINK_USDC){
            return USDC;
        } else if (market == GM_UNI_UNI_USDC){
            return USDC;
        } else if (market == GM_BTC_WBTC_USDC){
            return USDC;
        } else {
            revert("Market not supported");
        }
    }
}
