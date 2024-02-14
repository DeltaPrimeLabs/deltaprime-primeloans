// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2c04f8bbc145fcb8a91c9e51438a65729a4a81fc;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2Facet.sol";

contract GmxV2FacetAvalanche is GmxV2Facet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/avalanche/
    // GMX contracts
    function getGmxV2Router() internal pure virtual override returns (address) {
        return 0x820F5FfC5b525cD4d88Cd91aCf2c28F16530Cc68;
    }

    function getGmxV2ExchangeRouter() internal pure virtual override returns (address) {
        return 0x11E590f6092D557bF71BaDEd50D81521674F8275;
    }

    function getGmxV2DepositVault() internal pure virtual override returns (address) {
        return 0x90c670825d0C62ede1c5ee9571d6d9a17A722DFF;
    }

    function getGmxV2WithdrawalVault() internal pure virtual override returns (address) {
        return 0xf5F30B10141E1F63FC11eD772931A8294a591996;
    }
    
    // Markets
    address constant GM_BTC_BTCb_USDC = 0xFb02132333A79C8B5Bd0b64E3AbccA5f7fAf2937;
    address constant GM_ETH_WETHe_USDC = 0xB7e69749E3d2EDd90ea59A4932EFEa2D41E245d7;
    address constant GM_AVAX_WAVAX_USDC = 0x913C1F46b48b3eD35E7dc3Cf754d4ae8499F31CF;

    // Tokens
    address constant USDC = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    address constant BTCb = 0x152b9d0FdC40C096757F570A51E494bd4b943E50;
    address constant WETHe = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    // Mappings
    function marketToLongToken(address market) internal override pure returns (address){
        if(market == GM_BTC_BTCb_USDC){
            return BTCb;
        } else if (market == GM_ETH_WETHe_USDC){
            return WETHe;
        } else if (market == GM_AVAX_WAVAX_USDC){
            return WAVAX;
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
        } else {
            revert("Market not supported");
        }
    }

    // DEPOSIT
    function depositBtcUsdcGmxV2(uint256 longTokenAmount, uint256 shortTokenAmount, uint256 minGmAmount, uint256 executionFee) external payable {
        _deposit(GM_BTC_BTCb_USDC, longTokenAmount, shortTokenAmount, minGmAmount, executionFee);
    }

    function depositEthUsdcGmxV2(uint256 longTokenAmount, uint256 shortTokenAmount, uint256 minGmAmount, uint256 executionFee) external payable {
        _deposit(GM_ETH_WETHe_USDC, longTokenAmount, shortTokenAmount, minGmAmount, executionFee);
    }

    function depositAvaxUsdcGmxV2(uint256 longTokenAmount, uint256 shortTokenAmount, uint256 minGmAmount, uint256 executionFee) external payable {
        _deposit(GM_AVAX_WAVAX_USDC, longTokenAmount, shortTokenAmount, minGmAmount, executionFee);
    }

    // WITHDRAW
    function withdrawBtcUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable {
        _withdraw(GM_BTC_BTCb_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable {
        _withdraw(GM_ETH_WETHe_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function withdrawAvaxUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable  {
        _withdraw(GM_AVAX_WAVAX_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }
}
