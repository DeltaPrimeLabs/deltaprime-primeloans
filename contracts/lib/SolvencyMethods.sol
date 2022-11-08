// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "../facets/SolvencyFacetProd.sol";
import "../DiamondHelper.sol";

// TODO Rename to contract instead of lib
contract SolvencyMethods is DiamondHelper, ProxyConnector {
    // This function executes SolvencyFacetProd.getDebt()
    function _getDebt() internal virtual returns (uint256 debt) {
        debt = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getDebt.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getDebt.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getDebtWithPrices()
    function _getDebtWithPrices(SolvencyFacetProd.AssetPrice[] memory assetsPricesDebt) internal virtual returns (uint256 debt) {
        debt = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getDebtWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getDebtWithPrices.selector, assetsPricesDebt)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.isSolventWithPrices()
    function _isSolventWithPrices(SolvencyFacetProd.AssetPrice[] memory assetsPrices, SolvencyFacetProd.AssetPrice[] memory assetsPricesDebt) internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.isSolventWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.isSolventWithPrices.selector, assetsPrices, assetsPricesDebt)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacetProd.isSolvent()
    function _isSolvent() internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.isSolvent.selector),
                abi.encodeWithSelector(SolvencyFacetProd.isSolvent.selector)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacetProd.getTotalValue()
    function _getTotalValue() internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getTotalValue.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getTotalValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getTotalAssetsValue()
    function _getTotalAssetsValue() internal virtual returns (uint256 assetsValue) {
        assetsValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getTotalAssetsValue.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getTotalAssetsValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getHealthRatioWithPrices()
    function _getHealthRatioWithPrices(SolvencyFacetProd.AssetPrice[] memory assetsPrices, SolvencyFacetProd.AssetPrice[] memory assetsPricesDebt) public virtual returns (uint256 health) {
        health = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getHealthRatioWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getHealthRatioWithPrices.selector, assetsPrices, assetsPricesDebt)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getHealthRatio()
    function _getHealthRatio() public virtual returns (uint256 health) {
        health = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getHealthRatio.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getHealthRatio.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getPrices()
    function getPrices(bytes32[] memory symbols) public view virtual returns (uint256[] memory prices) {
        prices = abi.decode(
            ProxyConnector.proxyCalldataView(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getPrices.selector, symbols)
            ),
            (uint256[])
        );
    }

    // This function executes SolvencyFacetProd.getAssetsPrices()
    function _getAssetsPrices() internal view virtual returns (SolvencyFacetProd.AssetPrice[] memory assetsPrices) {
        assetsPrices = abi.decode(
            ProxyConnector.proxyCalldataView(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getAssetsPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getAssetsPrices.selector)
            ),
            (SolvencyFacetProd.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProd.getAssetsPricesDebt()
    function _getAssetsPricesDebt() internal view virtual returns (SolvencyFacetProd.AssetPrice[] memory assetsPrices) {
        assetsPrices = abi.decode(
            ProxyConnector.proxyCalldataView(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getAssetsPricesDebt.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getAssetsPricesDebt.selector)
            ),
            (SolvencyFacetProd.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProd.getTotalAssetsValueWithPrices()
    function _getTotalValueWithPrices(SolvencyFacetProd.AssetPrice[] memory assetsPrices) internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getTotalValueWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getTotalValueWithPrices.selector, assetsPrices)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getPrices()
    function getPrice(bytes32 symbol) public view virtual returns (uint256 price) {
        price = abi.decode(
            ProxyConnector.proxyCalldataView(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getPrice.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getPrice.selector, symbol)
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
    * Checks whether account is solvent (health higher than 1)
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;

        require(_isSolvent(), "The action may cause an account to become insolvent");
    }
}
