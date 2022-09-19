// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../facets/SolvencyFacet.sol";
import "../DiamondHelper.sol";

// TODO Rename to contract instead of lib
contract SolvencyMethodsLib is DiamondHelper {
    // This function executes SolvencyFacet.calculateDebt()
    function _getDebt() internal virtual returns (uint256 debt) {
        debt = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacet.getDebt.selector),
                abi.encodeWithSelector(SolvencyFacet.getDebt.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.isSolvent()
    function _isSolvent() internal virtual returns (bool solvent){
        solvent = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacet.isSolvent.selector),
                abi.encodeWithSelector(SolvencyFacet.isSolvent.selector)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacet.getTotalValue()
    function _getTotalValue() internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacet.getTotalValue.selector),
                abi.encodeWithSelector(SolvencyFacet.getTotalValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.getTotalAssetsValue()
    function _getTotalAssetsValue() internal virtual returns (uint256 assetsValue) {
        assetsValue = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacet.getTotalAssetsValue.selector),
                abi.encodeWithSelector(SolvencyFacet.getTotalAssetsValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.getLTV()
    function _getLTV() public virtual returns (uint256 ltv) {
        ltv = abi.decode(
            ProxyConnector.proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacet.getLTV.selector),
                abi.encodeWithSelector(SolvencyFacet.getLTV.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacet.getPrices()
    function getPrices(bytes32[] memory symbols) public view virtual returns (uint256[] memory prices) {
        prices = abi.decode(
            ProxyConnector.proxyCalldataView(
                DiamondHelper._getFacetAddress(SolvencyFacet.getPrices.selector),
                abi.encodeWithSelector(SolvencyFacet.getPrices.selector, symbols)
            ),
            (uint256[])
        );
    }

    // This function executes SolvencyFacet.getPrices()
    function getPrice(bytes32 symbol) public view virtual returns (uint256 price) {
        price = abi.decode(
            ProxyConnector.proxyCalldataView(
                DiamondHelper._getFacetAddress(SolvencyFacet.getPrice.selector),
                abi.encodeWithSelector(SolvencyFacet.getPrice.selector, symbol)
            ),
            (uint256)
        );
    }

    /**
     * Returns IERC20Metadata instance of a token
     * @param _asset the code of an asset
     **/
    function getERC20TokenInstance(bytes32 _asset, bool allowInactive) internal view returns (IERC20Metadata) {
        return IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(_asset, allowInactive));
    }

    /**
    * Checks whether account is solvent (LTV lower than getMaxLtv())
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;

        require(_isSolvent(), "The action may cause an account to become insolvent");
    }
}
