// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "../facets/SolvencyFacetProd.sol";
import "../facets/AssetsExposureController.sol";
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
    function _getDebtWithPrices(SolvencyFacetProd.AssetPrice[] memory debtAssetsPrices) internal virtual returns (uint256 debt) {
        debt = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getDebtWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getDebtWithPrices.selector, debtAssetsPrices)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.isSolventWithPrices()
    function _isSolventWithPrices(SolvencyFacetProd.CachedPrices memory cachedPrices) internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.isSolventWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.isSolventWithPrices.selector, cachedPrices)
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

    // This function executes SolvencyFacetProd.canRepayDebtFully()
    function _canRepayDebtFully() internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.canRepayDebtFully.selector),
                abi.encodeWithSelector(SolvencyFacetProd.canRepayDebtFully.selector)
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
    function _getHealthRatioWithPrices(SolvencyFacetProd.CachedPrices memory cachedPrices) public virtual returns (uint256 health) {
        health = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getHealthRatioWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getHealthRatioWithPrices.selector, cachedPrices)
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
    function getPrices(bytes32[] memory symbols) public virtual returns (uint256[] memory prices) {
        prices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getPrices.selector, symbols)
            ),
            (uint256[])
        );
    }

    // This function executes SolvencyFacetProd.getPrices()
    function _getAllPricesForLiquidation(bytes32[] memory assetsToRepay) public virtual returns (SolvencyFacetProd.CachedPrices memory result) {
        result = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getAllPricesForLiquidation.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getAllPricesForLiquidation.selector, assetsToRepay)
            ),
            (SolvencyFacetProd.CachedPrices)
        );
    }

    // This function executes SolvencyFacetProd.getOwnedAssetsWithNativePrices()
    function _getOwnedAssetsWithNativePrices() internal virtual returns (SolvencyFacetProd.AssetPrice[] memory ownedAssetsPrices) {
        ownedAssetsPrices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getOwnedAssetsWithNativePrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getOwnedAssetsWithNativePrices.selector)
            ),
            (SolvencyFacetProd.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProd.getDebtAssetsPrices()
    function _getDebtAssetsPrices() internal virtual returns (SolvencyFacetProd.AssetPrice[] memory debtAssetsPrices) {
        debtAssetsPrices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getDebtAssetsPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getDebtAssetsPrices.selector)
            ),
            (SolvencyFacetProd.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProd.getStakedPositionsPrices()
    function _getStakedPositionsPrices() internal virtual returns (SolvencyFacetProd.AssetPrice[] memory stakedPositionsPrices) {
        stakedPositionsPrices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getStakedPositionsPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getStakedPositionsPrices.selector)
            ),
            (SolvencyFacetProd.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProd.getTotalAssetsValueWithPrices()
    function _getTotalValueWithPrices(SolvencyFacetProd.AssetPrice[] memory ownedAssetsPrices, SolvencyFacetProd.AssetPrice[] memory stakedPositionsPrices) internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getTotalValueWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getTotalValueWithPrices.selector, ownedAssetsPrices, stakedPositionsPrices)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProd.getPrices()
    function getPrice(bytes32 symbol) public virtual returns (uint256 price) {
        price = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProd.getPrice.selector),
                abi.encodeWithSelector(SolvencyFacetProd.getPrice.selector, symbol)
            ),
            (uint256)
        );
    }

    // This function executes AssetsExposureController.decreaseAssetsExposure()
    function _decreaseAssetsExposure() public {
        proxyDelegateCalldata(
            DiamondHelper._getFacetAddress(AssetsExposureController.decreaseAssetsExposure.selector),
            abi.encodeWithSelector(AssetsExposureController.decreaseAssetsExposure.selector)
        );
    }

    // This function executes AssetsExposureController.increaseAssetsExposure()
    function _increaseAssetsExposure() public {
        proxyDelegateCalldata(
            DiamondHelper._getFacetAddress(AssetsExposureController.increaseAssetsExposure.selector),
            abi.encodeWithSelector(AssetsExposureController.increaseAssetsExposure.selector)
        );
    }

    /**
     * Returns IERC20Metadata instance of a token
     * @param _asset the code of an asset
     **/
    function getERC20TokenInstance(bytes32 _asset, bool allowInactive) internal view returns (IERC20Metadata) {
        return IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(_asset, allowInactive));
    }

    modifier recalculateAssetsExposure() {
        _decreaseAssetsExposure();
        _;
        _increaseAssetsExposure();
    }

    /**
    * Checks whether account is solvent (health higher than 1)
    * @dev This modifier uses the redstone-evm-connector
    **/
    modifier remainsSolvent() {
        _;

        require(_isSolvent(), "The action may cause an account to become insolvent");
    }

    modifier canRepayDebtFully() {
        _;
        require(_canRepayDebtFully(), "Insufficient assets to fully repay the debt");
    }
}
