// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2Facet.sol";

abstract contract GmxV2FacetAvalanche is GmxV2Facet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/avalanche/
    // GMX contracts
    function getGMX_V2_ROUTER() internal pure virtual override returns (address) {
        return 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    }

    function getGMX_V2_EXCHANGE_ROUTER() internal pure virtual override returns (address) {
        return 0x11E590f6092D557bF71BaDEd50D81521674F8275;
    }

    function getGMX_V2_DEPOSIT_VAULT() internal pure virtual override returns (address) {
        return 0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF;
    }

    function getGMX_V2_WITHDRAWAL_VAULT() internal pure virtual override returns (address) {
        return 0xf5F30B10141E1F63FC11eD772931A8294a591996;
    }

    // TODO: Dynamically source whitelisted keepers?
    function getGMX_V2_KEEPER() internal pure virtual override returns (address) {
        return 0xE47b36382DC50b90bCF6176Ddb159C4b9333A7AB;
    }

    // Markets
    address constant GM_BTC_BTCb_USDC = 0xFb02132333A79C8B5Bd0b64E3AbccA5f7fAf2937;
    address constant GM_ETH_WETHe_USDC = 0xB7e69749E3d2EDd90ea59A4932EFEa2D41E245d7;
    address constant GM_AVAX_WAVAX_USDC = 0x913C1F46b48b3eD35E7dc3Cf754d4ae8499F31CF;
    address constant GM_SOL_SOL_USDC = 0xd2eFd1eA687CD78c41ac262B3Bc9B53889ff1F70;

    // Tokens
    address constant USDC = 0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e;
    address constant BTCb = 0x152b9d0FdC40C096757F570A51E494bd4b943E50;
    address constant WETHe = 0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab;
    address constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address constant SOL = 0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F;

    // Mappings
    function marketToLongToken(address market) internal override pure returns (address){
        if(market == GM_BTC_BTCb_USDC){
            return BTCb;
        } else if (market == GM_ETH_WETHe_USDC){
            return WETHe;
        } else if (market == GM_AVAX_WAVAX_USDC){
            return WAVAX;
        } else if (market == GM_SOL_SOL_USDC){
            return SOL;
        } else {
            revert("Market not supported");
        }
    }

    function marketToShortToken(address market) internal override pure returns (address){
        if(market == GM_BTC_BTCb_USDC){
            return USDC;
        } else if (market == GM_ETH_WETHe_USDC){
            return USDC;
        } else if (market == GM_AVAX_WAVAX_USDC){
            return USDC;
        } else if (market == GM_SOL_SOL_USDC){
            return USDC;
        } else {
            revert("Market not supported");
        }
    }

    // DEPOSIT
    function depositBtcUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        address _depositedToken = isLongToken ? BTCb : USDC;

        _deposit(GM_BTC_BTCb_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

    function depositEthUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        address _depositedToken = isLongToken ? WETHe : USDC;

        _deposit(GM_ETH_WETHe_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

    function depositAvaxUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        address _depositedToken = isLongToken ? WAVAX : USDC;

        _deposit(GM_AVAX_WAVAX_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

    function depositSolUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        address _depositedToken = isLongToken ? SOL : USDC;

        _deposit(GM_SOL_SOL_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

    // WITHDRAW
    function withdrawBtcUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        _withdraw(GM_BTC_BTCb_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        _withdraw(GM_ETH_WETHe_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function withdrawAvaxUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        _withdraw(GM_AVAX_WAVAX_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function withdrawSolUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts {
        _withdraw(GM_SOL_SOL_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

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
            msg.sender == 0x6C21A841d6f029243AF87EF01f6772F05832144b
        ){
            _;
        } else {
            revert("Not whitelisted");
        }
    }
}
