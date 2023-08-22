// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: df6ee60ba901a98a553b7dba554089edd38b6f12;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@redstone-finance/evm-connector/contracts/data-services/AvalancheDataServiceConsumerBase.sol";
import "../interfaces/ITokenManager.sol";
import "../Pool.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract HealthMeterFacetProd is AvalancheDataServiceConsumerBase {
    struct AssetPrice {
        bytes32 asset;
        uint256 price;
    }

    /**
      * Returns an array of bytes32[] symbols of debt (borrowable) assets.
    **/
    function _getDebtAssets() internal view returns(bytes32[] memory result) {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        result = tokenManager.getAllPoolAssets();
    }

    /**
      * Returns an array of Asset/Price structs of enriched (always containing AVAX at index 0) owned assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function _getOwnedAssetsWithNativePrices() internal view returns(AssetPrice[] memory result) {
        bytes32[] memory assetsEnriched = _getOwnedAssetsWithNative();
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assetsEnriched);

        result = new AssetPrice[](assetsEnriched.length);

        for(uint i; i<assetsEnriched.length; i++){
            result[i] = AssetPrice({
                asset: assetsEnriched[i],
                price: prices[i]
            });
        }
    }

    /**
      * Returns list of owned assets that always included NativeToken at index 0
    **/
    function _getOwnedAssetsWithNative() internal view returns(bytes32[] memory){
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();

        // If account already owns the native token the use ownedAssets.length; Otherwise add one element to account for additional native token.
        uint256 numberOfAssets = DiamondStorageLib.hasAsset(nativeTokenSymbol) ? ownedAssets.length : ownedAssets.length + 1;
        bytes32[] memory assetsWithNative = new bytes32[](numberOfAssets);

        uint256 lastUsedIndex;
        assetsWithNative[0] = nativeTokenSymbol; // First asset = NativeToken

        for(uint i=0; i< ownedAssets.length; i++){
            if(ownedAssets[i] != nativeTokenSymbol){
                lastUsedIndex += 1;
                assetsWithNative[lastUsedIndex] = ownedAssets[i];
            }
        }
        return assetsWithNative;
    }

    /**
     * Returns current health meter (0% - 100%) associated with the loan
     * @dev This function uses the redstone-evm-connector
     */
    function getHealthMeter() public view returns (uint256) {
        AssetPrice[] memory ownedAssetsPrices = _getOwnedAssetsWithNativePrices();

        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedCollateral;
        uint256 weightedCollateralPlus = ownedAssetsPrices[0].price * address(this).balance * tokenManager.debtCoverage(tokenManager.getAssetAddress(nativeTokenSymbol, true)) / (10 ** 26);
        uint256 weightedCollateralMinus = 0;
        uint256 weightedBorrowed = 0;
        uint256 borrowed = 0;

        for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
            uint256 _balance = token.balanceOf(address(this));

            Pool pool;
            try tokenManager.getPoolAddress(ownedAssetsPrices[i].asset) returns (address poolAddress) {
                pool = Pool(poolAddress);
            } catch {
                weightedCollateralPlus = weightedCollateralPlus + (ownedAssetsPrices[i].price * _balance * tokenManager.debtCoverage(address(token)) / (10 ** token.decimals() * 1e8));
                continue;
            }
            uint256 _borrowed = pool.getBorrowed(address(this));
            if (_balance > _borrowed) {
                weightedCollateralPlus = weightedCollateralPlus + (ownedAssetsPrices[i].price * (_balance - _borrowed) * tokenManager.debtCoverage(address(token)) / (10 ** token.decimals() * 1e8));
            } else {
                weightedCollateralMinus = weightedCollateralMinus + (ownedAssetsPrices[i].price * (_borrowed - _balance) * tokenManager.debtCoverage(address(token)) / (10 ** token.decimals() * 1e8));
            }
            weightedBorrowed = weightedBorrowed + (ownedAssetsPrices[i].price * _borrowed * tokenManager.debtCoverage(address(token)) / (10 ** token.decimals() * 1e8));
            borrowed = borrowed + (ownedAssetsPrices[i].price * _borrowed * 1e10 / (10 ** token.decimals()));
        }
        if (weightedCollateralPlus > weightedCollateralMinus) {
            weightedCollateral = weightedCollateralPlus - weightedCollateralMinus;
        }

        uint256 multiplier = 100 * 1e18; // 18 decimal points

        if (borrowed == 0) return multiplier;

        if (weightedCollateral > 0 && weightedCollateral + weightedBorrowed > borrowed) {
            return (weightedCollateral + weightedBorrowed - borrowed) * multiplier / weightedCollateral;
        }

        return 0;
    }
}
