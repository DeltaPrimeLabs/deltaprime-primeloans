// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../oracle/RSOracleMock3Signers.sol";
import "../../TokenManager.sol";
import "../../Pool.sol";
import "../../DiamondHelper.sol";
import "../../interfaces/IStakingPositions.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract SolvencyFacetMock is RSOracleMock3Signers, DiamondHelper {
    struct AssetPrice {
        bytes32 asset;
        uint256 price;
    }

    // Struct used in the liquidation process to obtain necessary prices only once
    struct CachedPrices {
        AssetPrice[] ownedAssetsPrices;
        AssetPrice[] debtAssetsPrices;
        AssetPrice[] stakedPositionsPrices;
        AssetPrice[] assetsToRepayPrices;
    }

    /**
      * Checks if the loan is solvent.
      * It means that the Health Ratio is greater than 1e18.
      * @dev This function uses the redstone-evm-connector
    **/
    function isSolvent() public view returns (bool) {
        return getHealthRatio() >= 1e18;
    }

    /**
      * Checks if the loan is solvent.
      * It means that the Health Ratio is greater than 1e18.
      * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
      * @param ownedAssetsPrices An array of Asset/Price structs used to calculate weighted value of owned assets
      * @param debtAssetsPrices An array of Asset/Price structs used to calculate value of the debt
      * @param stakedPositionsPrices An array of Asset/Price structs used to calculate value of the staked positions
    **/
    function isSolventWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory debtAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view returns (bool) {
        return getHealthRatioWithPrices(ownedAssetsPrices, debtAssetsPrices, stakedPositionsPrices) >= 1e18;
    }

    /**
      * Returns an array of Asset/Price structs of staked positions.
      * @dev This function uses the redstone-evm-connector
    **/
    function getStakedPositionsPrices() public view returns(AssetPrice[] memory result) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        bytes32[] memory symbols = new bytes32[](positions.length);
        for(uint256 i=0; i<positions.length; i++) {
            symbols[i] = positions[i].symbol;
        }

        uint256[] memory stakedPositionsPrices = getOracleNumericValuesWithDuplicatesFromTxMsg(symbols);
        result = new AssetPrice[](stakedPositionsPrices.length);

        for(uint i; i<stakedPositionsPrices.length; i++){
            result[i] = AssetPrice({
            asset: symbols[i],
            price: stakedPositionsPrices[i]
            });
        }
    }

    /**
      * Returns an array of bytes32[] symbols of debt (borrowable) assets.
    **/
    function getDebtAssets() public view returns(bytes32[] memory result) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        result = tokenManager.getAllPoolAssets();
    }

    /**
      * Returns an array of Asset/Price structs of debt (borrowable) assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function getDebtAssetsPrices() public view returns(AssetPrice[] memory result) {
        bytes32[] memory debtAssets = getDebtAssets();

        uint256[] memory debtAssetsPrices = getOracleNumericValuesFromTxMsg(debtAssets);
        result = new AssetPrice[](debtAssetsPrices.length);

        for(uint i; i<debtAssetsPrices.length; i++){
            result[i] = AssetPrice({
            asset: debtAssets[i],
            price: debtAssetsPrices[i]
            });
        }
    }

    /**
      * Returns an array of Asset/Price structs of enriched (always containing AVAX at index 0) owned assets.
      * @dev This function uses the redstone-evm-connector
    **/
    function getOwnedAssetWithNativePrices() public view returns(AssetPrice[] memory result) {
        bytes32[] memory assetsEnriched = getOwnedAssetsWithNative();
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
      * Returns an array of bytes32[] symbols of staked positions.
    **/
    function getStakedAssets() internal view returns (bytes32[] memory result) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        result = new bytes32[](positions.length);
        for(uint i; i<positions.length; i++) {
            result[i] = positions[i].symbol;
        }
    }

    /**
      * Returns CachedPrices struct consisting of Asset/Price arrays for ownedAssets, debtAssets, stakedPositions and assetsToRepay.
      * Used during the liquidation process in order to obtain all necessary prices from calldata only once.
      * @dev This function uses the redstone-evm-connector
    **/
    function getAllPricesForLiquidation(bytes32[] calldata assetsToRepay) public view returns (CachedPrices memory result) {
        bytes32[] memory ownedAssetsEnriched = getOwnedAssetsWithNative();
        bytes32[] memory debtAssets = getDebtAssets();
        bytes32[] memory stakedAssets = getStakedAssets();

        bytes32[] memory allAssetsSymbols = new bytes32[](ownedAssetsEnriched.length + debtAssets.length + stakedAssets.length + assetsToRepay.length);
        uint256 offset;

        // Populate allAssetsSymbols with owned assets symbols
        for(uint i; i<ownedAssetsEnriched.length; i++){
            allAssetsSymbols[i] = ownedAssetsEnriched[i];
        }
        offset += ownedAssetsEnriched.length;

        // Populate allAssetsSymbols with debt assets symbols
        for(uint i; i<debtAssets.length; i++){
            allAssetsSymbols[i+offset] = debtAssets[i];
        }
        offset += debtAssets.length;

        // Populate allAssetsSymbols with staked assets symbols
        for(uint i; i<stakedAssets.length; i++){
            allAssetsSymbols[i+offset] = stakedAssets[i];
        }
        offset += stakedAssets.length;

        // Populate allAssetsSymbols with assets to repay symbols
        for(uint i; i<assetsToRepay.length; i++){
            allAssetsSymbols[i+offset] = assetsToRepay[i];
        }

        uint256[] memory allAssetsPrices = getOracleNumericValuesWithDuplicatesFromTxMsg(allAssetsSymbols);

        offset = 0;

        // Populate ownedAssetsPrices struct
        AssetPrice[] memory ownedAssetsPrices = new AssetPrice[](ownedAssetsEnriched.length);
        for(uint i=0; i<ownedAssetsEnriched.length; i++){
            ownedAssetsPrices[i] = AssetPrice({
            asset: allAssetsSymbols[i+offset],
            price: allAssetsPrices[i+offset]
            });
        }
        offset += ownedAssetsEnriched.length;

        // Populate debtAssetsPrices struct
        AssetPrice[] memory debtAssetsPrices = new AssetPrice[](debtAssets.length);
        for(uint i=0; i<debtAssets.length; i++){
            debtAssetsPrices[i] = AssetPrice({
            asset: allAssetsSymbols[i+offset],
            price: allAssetsPrices[i+offset]
            });
        }
        offset += debtAssetsPrices.length;

        // Populate stakedPositionsPrices struct
        AssetPrice[] memory stakedPositionsPrices = new AssetPrice[](stakedAssets.length);
        for(uint i=0; i<stakedAssets.length; i++){
            stakedPositionsPrices[i] = AssetPrice({
            asset: allAssetsSymbols[i+offset],
            price: allAssetsPrices[i+offset]
            });
        }
        offset += stakedAssets.length;

        // Populate assetsToRepayPrices struct
        AssetPrice[] memory assetsToRepayPrices = new AssetPrice[](assetsToRepay.length);
        for(uint i=0; i<assetsToRepay.length; i++){
            assetsToRepayPrices[i] = AssetPrice({
            asset: allAssetsSymbols[i+offset],
            price: allAssetsPrices[i+offset]
            });
        }

        result = CachedPrices({
        ownedAssetsPrices: ownedAssetsPrices,
        debtAssetsPrices: debtAssetsPrices,
        stakedPositionsPrices: stakedPositionsPrices,
        assetsToRepayPrices: assetsToRepayPrices
        });
    }

    // Check whether there is enough debt-denominated tokens to fully repaid what was previously borrowed
    function canRepayDebtFully() external view returns(bool) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory poolAssets = tokenManager.getAllPoolAssets();

        for(uint i; i< poolAssets.length; i++) {
            Pool pool = Pool(DeploymentConstants.getTokenManager().getPoolAddress(poolAssets[i]));
            IERC20 token = IERC20(pool.tokenAddress());
            if(token.balanceOf(address(this)) < pool.getBorrowed(address(this))) {
                return false;
            }
        }
        return true;
    }

    /**
      * Helper method exposing the redstone-evm-connector getOracleNumericValuesFromTxMsg() method.
      * @dev This function uses the redstone-evm-connector
    **/
    function getPrices(bytes32[] memory symbols) external view returns (uint256[] memory) {
        return getOracleNumericValuesFromTxMsg(symbols);
    }

    /**
      * Helper method exposing the redstone-evm-connector getOracleNumericValueFromTxMsg() method.
      * @dev This function uses the redstone-evm-connector
    **/
    function getPrice(bytes32 symbol) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(symbol);
    }

    /**
      * Returns TotalWeightedValue of OwnedAssets in USD based on the supplied array of Asset/Price struct, tokenBalance and debtCoverage
    **/
    function _getTWVOwnedAssets(AssetPrice[] memory ownedAssetsPrices) internal view returns (uint256) {
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();
        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedValueOfTokens = ownedAssetsPrices[0].price * address(this).balance * tokenManager.debtCoverage(tokenManager.getAssetAddress(nativeTokenSymbol, true)) / (10 ** 26);

        if (ownedAssetsPrices.length > 0) {

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                weightedValueOfTokens = weightedValueOfTokens + (ownedAssetsPrices[i].price * token.balanceOf(address(this)) * tokenManager.debtCoverage(address(token)) / (10 ** token.decimals() * 1e8));
            }
        }
        return weightedValueOfTokens;
    }

    /**
      * Returns TotalWeightedValue of StakedPositions in USD based on the supplied array of Asset/Price struct, positionBalance and debtCoverage
    **/
    function _getTWVStakedPositions(AssetPrice[] memory stakedPositionsPrices) internal view returns (uint256) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        uint256 weightedValueOfStaked;

        for (uint256 i; i < positions.length; i++) {
            require(stakedPositionsPrices[i].asset == positions[i].symbol, "Position-price symbol mismatch.");

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));

            if (success) {
                uint256 balance = abi.decode(result, (uint256));

                IERC20Metadata token = IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(stakedPositionsPrices[i].asset, true));

                weightedValueOfStaked += stakedPositionsPrices[i].price * 10 ** 10 * balance * tokenManager.debtCoverage(positions[i].vault) / (10 ** token.decimals());
            }
        }
        return weightedValueOfStaked;
    }

    function _getThresholdWeightedValueBase(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) internal view virtual returns (uint256) {
        return _getTWVOwnedAssets(ownedAssetsPrices) + _getTWVStakedPositions(stakedPositionsPrices);
    }

    /**
      * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
      * @dev This function uses the redstone-evm-connector
    **/
    function getThresholdWeightedValue() public view virtual returns (uint256) {
        AssetPrice[] memory ownedAssetsPrices = getOwnedAssetWithNativePrices();
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
        return _getThresholdWeightedValueBase(ownedAssetsPrices, stakedPositionsPrices);
    }

    /**
      * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
      * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
    **/
    function getThresholdWeightedValueWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        return _getThresholdWeightedValueBase(ownedAssetsPrices, stakedPositionsPrices);
    }


    /**
     * Returns the current debt denominated in USD
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getDebtBase(AssetPrice[] memory debtAssetsPrices) internal view returns (uint256){
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 debt;

        for (uint256 i; i < debtAssetsPrices.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(debtAssetsPrices[i].asset, true));

            Pool pool = Pool(tokenManager.getPoolAddress(debtAssetsPrices[i].asset));
            //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10
            debt = debt + pool.getBorrowed(address(this)) * debtAssetsPrices[i].price * 10 ** 10
            / 10 ** token.decimals();
        }

        return debt;
    }

    /**
     * Returns the current debt denominated in USD
     * @dev This function uses the redstone-evm-connector
    **/
    function getDebt() public view virtual returns (uint256) {
        AssetPrice[] memory debtAssetsPrices = getDebtAssetsPrices();
        return getDebtBase(debtAssetsPrices);
    }

    /**
     * Returns the current debt denominated in USD
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getDebtWithPrices(AssetPrice[] memory debtAssetsPrices) public view virtual returns (uint256) {
        return getDebtBase(debtAssetsPrices);
    }


    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function _getTotalAssetsValueBase(AssetPrice[] memory ownedAssetsPrices) public view returns (uint256) {
        if (ownedAssetsPrices.length > 0) {
            TokenManager tokenManager = DeploymentConstants.getTokenManager();

            uint256 total = address(this).balance * ownedAssetsPrices[0].price / 10 ** 8;

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                uint256 assetBalance = token.balanceOf(address(this));

                total = total + (ownedAssetsPrices[i].price * 10 ** 10 * assetBalance / (10 ** token.decimals()));
            }
            return total;
        } else {
            return 0;
        }
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getTotalAssetsValue() public view virtual returns (uint256) {
        AssetPrice[] memory ownedAssetsPrices = getOwnedAssetWithNativePrices();
        return _getTotalAssetsValueBase(ownedAssetsPrices);
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getTotalAssetsValueWithPrices(AssetPrice[] memory ownedAssetsPrices) public view virtual returns (uint256) {
        return _getTotalAssetsValueBase(ownedAssetsPrices);
    }

    /**
      * Returns list of owned assets that always included NativeToken at index 0
    **/
    function getOwnedAssetsWithNative() public view returns(bytes32[] memory){
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
     * Returns the current value of staked positions in USD.
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function _getStakedValueBase(AssetPrice[] memory stakedPositionsPrices) internal view returns (uint256) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        uint256 usdValue;

        for (uint256 i; i < positions.length; i++) {
            require(stakedPositionsPrices[i].asset == positions[i].symbol, "Position-price symbol mismatch.");

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));

            if (success) {
                uint256 balance = abi.decode(result, (uint256));

                IERC20Metadata token = IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(stakedPositionsPrices[i].asset, true));

                usdValue += stakedPositionsPrices[i].price * 10 ** 10 * balance / (10 ** token.decimals());
            }
        }

        return usdValue;
    }

    /**
     * Returns the current value of staked positions in USD.
     * Uses provided AssetPrice struct array instead of extracting the pricing data from the calldata again.
    **/
    function getStakedValueWithPrices(AssetPrice[] memory stakedPositionsPrices) public view returns (uint256) {
        return _getStakedValueBase(stakedPositionsPrices);
    }

    /**
     * Returns the current value of staked positions in USD.
     * @dev This function uses the redstone-evm-connector
    **/
    function getStakedValue() public view virtual returns (uint256) {
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
        return _getStakedValueBase(stakedPositionsPrices);
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
    **/
    function getTotalValue() public view virtual returns (uint256) {
        return getTotalAssetsValue() + getStakedValue();
    }

    /**
     * Returns the current value of Prime Account in USD including all tokens as well as staking and LP positions
     * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
    **/
    function getTotalValueWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        return getTotalAssetsValueWithPrices(ownedAssetsPrices) + getStakedValueWithPrices(stakedPositionsPrices);
    }

    function getFullLoanStatus() public view returns (uint256[5] memory) {
        return [getTotalValue(), getDebt(), getThresholdWeightedValue(), getHealthRatio(), isSolvent() ? uint256(1) : uint256(0)];
    }

    /**
     * Returns current health ratio (solvency) associated with the loan, defined as threshold weighted value of divided
     * by current debt
     * @dev This function uses the redstone-evm-connector
     **/
    function getHealthRatio() public view virtual returns (uint256) {
        uint256 debt = getDebt();
        uint256 thresholdWeightedValue = getThresholdWeightedValue();

        if (debt == 0) {
            return type(uint256).max;
        } else {
            return thresholdWeightedValue * 1e18 / debt;
        }
    }

    /**
     * Returns current health ratio (solvency) associated with the loan, defined as threshold weighted value of divided
     * by current debt
     * Uses provided AssetPrice struct arrays instead of extracting the pricing data from the calldata again.
     **/
    function getHealthRatioWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory debtAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        uint256 debt = getDebtWithPrices(debtAssetsPrices);
        uint256 thresholdWeightedValue = getThresholdWeightedValueWithPrices(ownedAssetsPrices, stakedPositionsPrices);

        if (debt == 0) {
            return type(uint256).max;
        } else {
            return thresholdWeightedValue * 1e18 / debt;
        }
    }
}
