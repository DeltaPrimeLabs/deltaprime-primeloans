// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 4ad7b1532b12e0253817f898bca47228d3b907e0;
pragma solidity 0.8.17;

//This path is updated during deployment
import "../GmxV2CallbacksFacet.sol";

contract GmxV2CallbacksFacetAvalanche is GmxV2CallbacksFacet {
    using TransferHelper for address;

    // https://github.com/gmx-io/gmx-synthetics/blob/main/deployments/avalanche/
    // GMX contracts

    function getGmxV2RoleStore() internal pure virtual override returns (address){
        return 0xA44F830B6a2B6fa76657a3B92C1fe74fcB7C6AfD;
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
}
