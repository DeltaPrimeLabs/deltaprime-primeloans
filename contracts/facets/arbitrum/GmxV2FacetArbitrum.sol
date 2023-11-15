// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 36a0b698bf0187eb99ba20481d3d009a774fb718;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2Facet.sol";

contract GmxV2FacetArbitrum is GmxV2Facet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/arbitrum/
    // GMX contracts
    function getGMX_V2_ROUTER() internal pure virtual override returns (address) {
        return 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    }

    function getGMX_V2_EXCHANGE_ROUTER() internal pure virtual override returns (address) {
        return 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8;
    }

    function getGMX_V2_DEPOSIT_VAULT() internal pure virtual override returns (address) {
        return 0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55;
    }

    function getGMX_V2_WITHDRAWAL_VAULT() internal pure virtual override returns (address) {
        return 0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55;
    }

    function getGMX_V2_ROLE_STORE() internal pure virtual override returns (address){
        return 0x3c3d99FD298f679DBC2CEcd132b4eC4d0F5e6e72;
    }

    // Markets
    address constant GM_ETH_WETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address constant GM_ARB_ARB_USDC = 0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407;
    address constant GM_LINK_LINK_USDC = 0x7f1fa204bb700853D36994DA19F830b6Ad18455C;
    address constant GM_UNI_UNI_USDC = 0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50;
    address constant GM_SOL_SOL_USDC = 0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9;
    address constant GM_BTC_WBTC_USDC = 0x47c031236e19d024b42f8AE6780E44A573170703;

    // Tokens
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    address constant LINK = 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4;
    address constant UNI = 0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0;
    address constant SOL = 0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07;
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
        } else if (market == GM_SOL_SOL_USDC){
            return SOL;
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
        } else if (market == GM_SOL_SOL_USDC){
            return USDC;
        } else if (market == GM_BTC_WBTC_USDC){
            return USDC;
        } else {
            revert("Market not supported");
        }
    }

    // DEPOSIT
    function depositEthUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts  {
        address _depositedToken = isLongToken ? WETH : USDC;

        _deposit(GM_ETH_WETH_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

//    function depositArbUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        address _depositedToken = isLongToken ? ARB : USDC;
//
//        _deposit(GM_ARB_ARB_USDC, isLongToken ? ARB : USDC, tokenAmount, minGmAmount, executionFee);
//    }
//
//    function depositLinkUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        address _depositedToken = isLongToken ? LINK : USDC;
//
//        _deposit(GM_LINK_LINK_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
//    }
//
//    function depositUniUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        address _depositedToken = isLongToken ? UNI : USDC;
//
//        _deposit(GM_UNI_UNI_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
//    }
//
//    function depositSolUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        address _depositedToken = isLongToken ? SOL : USDC;
//
//        _deposit(GM_SOL_SOL_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
//    }
//
//    function depositBtcUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        address _depositedToken = isLongToken ? WBTC : USDC;
//
//        _deposit(GM_BTC_WBTC_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
//    }

    // WITHDRAW
    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        _withdraw(GM_ETH_WETH_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

//    function withdrawArbUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        _withdraw(GM_ARB_ARB_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
//    }
//
//    function withdrawLinkUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        _withdraw(GM_LINK_LINK_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
//    }
//
//    function withdrawUniUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        _withdraw(GM_UNI_UNI_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
//    }
//
//    function withdrawSolUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        _withdraw(GM_SOL_SOL_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
//    }
//
//    function withdrawBtcUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
//        _withdraw(GM_BTC_WBTC_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
//    }

    // MODIFIERS
    modifier onlyWhitelistedAccounts {
        if(
            msg.sender == 0x0E5Bad4108a6A5a8b06820f98026a7f3A77466b2 ||
            msg.sender == 0x2fFA7E9624B923fA811d9B9995Aa34b715Db1945 ||
            msg.sender == 0x0d7137feA34BC97819f05544Ec7DE5c98617989C ||
            msg.sender == 0xC6ba6BB819f1Be84EFeB2E3f2697AD9818151e5D ||
            msg.sender == 0x14f69F9C351b798dF31fC53E33c09dD29bFAb547 ||
            msg.sender == 0x5C23Bd1BD272D22766eB3708B8f874CB93B75248 ||
            msg.sender == 0x000000F406CA147030BE7069149e4a7423E3A264 ||
            msg.sender == 0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12 ||
            msg.sender == 0xb79c2A75cd9073d68E75ddF71D53C07747Df7933 ||
            msg.sender == 0xb79c2A75cd9073d68E75ddF71D53C07747Df7933
        ){
            _;
        } else {
            revert("Not whitelisted");
        }
    }
}
