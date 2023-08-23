// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "../facets/avalanche/SolvencyFacetProdAvalanche.sol";
import "../facets/AssetsExposureController.sol";
import "../DiamondHelper.sol";

// TODO Rename to contract instead of lib
contract SolvencyMethods is DiamondHelper, ProxyConnector {
    // This function executes SolvencyFacetProdAvalanche.getDebt()
    function _getDebt() internal virtual returns (uint256 debt) {
        debt = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getDebt.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getDebt.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getDebtWithPrices()
    function _getDebtWithPrices(SolvencyFacetProdAvalanche.AssetPrice[] memory debtAssetsPrices) internal virtual returns (uint256 debt) {
        debt = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getDebtWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getDebtWithPrices.selector, debtAssetsPrices)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.isSolventWithPrices()
    function _isSolventWithPrices(SolvencyFacetProdAvalanche.CachedPrices memory cachedPrices) internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.isSolventWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.isSolventWithPrices.selector, cachedPrices)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.isSolvent()
    function _isSolvent() internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.isSolvent.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.isSolvent.selector)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.canRepayDebtFully()
    function _canRepayDebtFully() internal virtual returns (bool solvent){
        solvent = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.canRepayDebtFully.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.canRepayDebtFully.selector)
            ),
            (bool)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getTotalValue()
    function _getTotalValue() internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getTotalValue.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getTotalValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getTotalAssetsValue()
    function _getTotalAssetsValue() internal virtual returns (uint256 assetsValue) {
        assetsValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getTotalAssetsValue.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getTotalAssetsValue.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getHealthRatioWithPrices()
    function _getHealthRatioWithPrices(SolvencyFacetProdAvalanche.CachedPrices memory cachedPrices) public virtual returns (uint256 health) {
        health = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getHealthRatioWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getHealthRatioWithPrices.selector, cachedPrices)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getHealthRatio()
    function _getHealthRatio() public virtual returns (uint256 health) {
        health = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getHealthRatio.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getHealthRatio.selector)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getPrices()
    function getPrices(bytes32[] memory symbols) public virtual returns (uint256[] memory prices) {
        prices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getPrices.selector, symbols)
            ),
            (uint256[])
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getPrices()
    function _getAllPricesForLiquidation(bytes32[] memory assetsToRepay) public virtual returns (SolvencyFacetProdAvalanche.CachedPrices memory result) {
        result = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getAllPricesForLiquidation.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getAllPricesForLiquidation.selector, assetsToRepay)
            ),
            (SolvencyFacetProdAvalanche.CachedPrices)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getOwnedAssetsWithNativePrices()
    function _getOwnedAssetsWithNativePrices() internal virtual returns (SolvencyFacetProdAvalanche.AssetPrice[] memory ownedAssetsPrices) {
        ownedAssetsPrices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getOwnedAssetsWithNativePrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getOwnedAssetsWithNativePrices.selector)
            ),
            (SolvencyFacetProdAvalanche.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getDebtAssetsPrices()
    function _getDebtAssetsPrices() internal virtual returns (SolvencyFacetProdAvalanche.AssetPrice[] memory debtAssetsPrices) {
        debtAssetsPrices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getDebtAssetsPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getDebtAssetsPrices.selector)
            ),
            (SolvencyFacetProdAvalanche.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getStakedPositionsPrices()
    function _getStakedPositionsPrices() internal virtual returns (SolvencyFacetProdAvalanche.AssetPrice[] memory stakedPositionsPrices) {
        stakedPositionsPrices = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getStakedPositionsPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getStakedPositionsPrices.selector)
            ),
            (SolvencyFacetProdAvalanche.AssetPrice[])
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getTotalAssetsValueWithPrices()
    function _getTotalValueWithPrices(SolvencyFacetProdAvalanche.AssetPrice[] memory ownedAssetsPrices, SolvencyFacetProdAvalanche.AssetPrice[] memory stakedPositionsPrices) internal virtual returns (uint256 totalValue) {
        totalValue = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getTotalValueWithPrices.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getTotalValueWithPrices.selector, ownedAssetsPrices, stakedPositionsPrices)
            ),
            (uint256)
        );
    }

    // This function executes SolvencyFacetProdAvalanche.getPrices()
    function getPrice(bytes32 symbol) public virtual returns (uint256 price) {
        price = abi.decode(
            proxyDelegateCalldata(
                DiamondHelper._getFacetAddress(SolvencyFacetProdAvalanche.getPrice.selector),
                abi.encodeWithSelector(SolvencyFacetProdAvalanche.getPrice.selector, symbol)
            ),
            (uint256)
        );
    }

    // This function executes AssetsExposureController.decreaseAssetsExposure()
    function _resetPrimeAccountAssetsExposure() public {
        proxyDelegateCalldata(
            DiamondHelper._getFacetAddress(AssetsExposureController.resetPrimeAccountAssetsExposure.selector),
            abi.encodeWithSelector(AssetsExposureController.resetPrimeAccountAssetsExposure.selector)
        );
    }

    // This function executes AssetsExposureController.increaseAssetsExposure()
    function _setPrimeAccountAssetsExposure() public {
        proxyDelegateCalldata(
            DiamondHelper._getFacetAddress(AssetsExposureController.setPrimeAccountAssetsExposure.selector),
            abi.encodeWithSelector(AssetsExposureController.setPrimeAccountAssetsExposure.selector)
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
        _resetPrimeAccountAssetsExposure();
        _;
        _setPrimeAccountAssetsExposure();
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

    modifier noBorrowInTheSameBlock() {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        require(ds._lastBorrowTimestamp != block.timestamp, "Borrowing must happen in a standalone transaction");
        _;
    }
}
