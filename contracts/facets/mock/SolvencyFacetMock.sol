// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
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

    struct CachedPrices {
        AssetPrice[] ownedAssetsPrices;
        AssetPrice[] debtAssetsPrices;
        AssetPrice[] stakedPositionsPrices;
        AssetPrice[] assetsToRepayPrices;
    }
    
    /**
    * Checks if the loan is solvent.
    * It means that the ratio between borrowing power and current devt (defined as total value minus debt) is above safe level
    * @dev This function uses the redstone-evm-connector
    **/
    function isSolvent() public view returns (bool) {
        return getHealthRatio() >= 1e18;
    }

    /**
        * Checks if the loan is solvent.
        * It means that the ratio between borrowing power and current devt (defined as total value minus debt) is above safe level
        * @dev This function uses the redstone-evm-connector
        **/
    function isSolventWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory debtAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view returns (bool) {
        return getHealthRatioWithPrices(ownedAssetsPrices, debtAssetsPrices, stakedPositionsPrices) >= 1e18;
    }

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

    function getDebtAssets() public view returns(bytes32[] memory result) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        result = tokenManager.getAllPoolAssets();
    }

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

    function getOwnedAssetsPrices() public view returns(AssetPrice[] memory result) {
        bytes32[] memory assetsEnriched = getOwnedAssetsEnriched();
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assetsEnriched);

        result = new AssetPrice[](assetsEnriched.length);

        for(uint i; i<assetsEnriched.length; i++){
            result[i] = AssetPrice({
                asset: assetsEnriched[i],
                price: prices[i]
            });
        }
    }

    function getStakedAssets() internal view returns (bytes32[] memory result) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();
        result = new bytes32[](positions.length);
        for(uint i; i<positions.length; i++) {
            result[i] = positions[i].symbol;
        }
    }

    function getAllPricesForLiquidation(bytes32[] calldata assetsToRepay) public view returns (CachedPrices memory result) {
        bytes32[] memory ownedAssetsEnriched = getOwnedAssetsEnriched();
        bytes32[] memory debtAssets = getDebtAssets();
        bytes32[] memory stakedAssets = getStakedAssets();

        bytes32[] memory allAssetsSymbols = new bytes32[](ownedAssetsEnriched.length + debtAssets.length + stakedAssets.length + assetsToRepay.length);
        uint256 offset;

        for(uint i; i<ownedAssetsEnriched.length; i++){
            allAssetsSymbols[i] = ownedAssetsEnriched[i];
        }
        offset += ownedAssetsEnriched.length;

        for(uint i; i<debtAssets.length; i++){
            allAssetsSymbols[i+offset] = debtAssets[i];
        }
        offset += debtAssets.length;

        for(uint i; i<stakedAssets.length; i++){
            allAssetsSymbols[i+offset] = stakedAssets[i];
        }
        offset += stakedAssets.length;

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

    function getPrices(bytes32[] memory symbols) external view returns (uint256[] memory) {
        return getOracleNumericValuesFromTxMsg(symbols);
    }

    function getPrice(bytes32 symbol) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(symbol);
    }

    function _getTWVOwnedAssets(AssetPrice[] memory ownedAssetsPrices) internal view returns (uint256) {
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();
        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedValueOfTokens;

        if (ownedAssetsPrices.length > 0) {
            // TODO: double check the decimals
            weightedValueOfTokens = ownedAssetsPrices[0].price * address(this).balance * tokenManager.maxTokenLeverage(tokenManager.getAssetAddress(nativeTokenSymbol, true)) / (10 ** 26);

            for (uint256 i = 0; i < ownedAssetsPrices.length; i++) {
                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(ownedAssetsPrices[i].asset, true));
                weightedValueOfTokens = weightedValueOfTokens + (ownedAssetsPrices[i].price * 10 ** 10 * token.balanceOf(address(this)) * tokenManager.maxTokenLeverage(address(token)) / (10 ** token.decimals() * 1e18));
            }
        }
        return weightedValueOfTokens;
    }

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

                weightedValueOfStaked += stakedPositionsPrices[i].price * 10 ** 10 * balance * tokenManager.maxTokenLeverage(positions[i].vault) / (10 ** token.decimals());
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
        AssetPrice[] memory ownedAssetsPrices = getOwnedAssetsPrices();
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
        return _getThresholdWeightedValueBase(ownedAssetsPrices, stakedPositionsPrices);
    }

    /**
     * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getThresholdWeightedValueWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        return _getThresholdWeightedValueBase(ownedAssetsPrices, stakedPositionsPrices);
    }

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
   * Returns the current debt from all lending pools
   * @dev This function uses the redstone-evm-connector
   **/
    function getDebt() public view virtual returns (uint256) {
        AssetPrice[] memory debtAssetsPrices = getDebtAssetsPrices();
        return getDebtBase(debtAssetsPrices);
    }

    function getDebtWithPrices(AssetPrice[] memory debtAssetsPrices) public view virtual returns (uint256) {
        return getDebtBase(debtAssetsPrices);
    }

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
        AssetPrice[] memory ownedAssetsPrices = getOwnedAssetsPrices();
        return _getTotalAssetsValueBase(ownedAssetsPrices);
    }

    function getTotalAssetsValueWithPrices(AssetPrice[] memory ownedAssetsPrices) public view virtual returns (uint256) {
        return _getTotalAssetsValueBase(ownedAssetsPrices);
    }

    // Returns list of owned assets that always included NativeToken at index 0
    function getOwnedAssetsEnriched() public view returns(bytes32[] memory){
        bytes32[] memory ownedAssets = DeploymentConstants.getAllOwnedAssets();
        bytes32 nativeTokenSymbol = DeploymentConstants.getNativeTokenSymbol();

        uint256 numberOfAssets = DiamondStorageLib.hasAsset(nativeTokenSymbol) ? ownedAssets.length : ownedAssets.length + 1;
        bytes32[] memory assetsEnriched = new bytes32[](numberOfAssets);

        uint256 lastUsedIndex;
        assetsEnriched[0] = nativeTokenSymbol; // First asset = NativeToken

        for(uint i=0; i< ownedAssets.length; i++){
            if(ownedAssets[i] != nativeTokenSymbol){
                lastUsedIndex += 1;
                assetsEnriched[lastUsedIndex] = ownedAssets[i];
            }
        }
        return assetsEnriched;
    }

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

    function getStakedValueWithPrices(AssetPrice[] memory stakedPositionsPrices) public view returns (uint256) {
        return _getStakedValueBase(stakedPositionsPrices);
    }

    function getStakedValue() public view virtual returns (uint256) {
        AssetPrice[] memory stakedPositionsPrices = getStakedPositionsPrices();
        return _getStakedValueBase(stakedPositionsPrices);
    }

    function getTotalValue() public view virtual returns (uint256) {
        return getTotalAssetsValue() + getStakedValue();
    }

    function getTotalValueWithPrices(AssetPrice[] memory ownedAssetsPrices, AssetPrice[] memory stakedPositionsPrices) public view virtual returns (uint256) {
        return getTotalAssetsValueWithPrices(ownedAssetsPrices) + getStakedValueWithPrices(stakedPositionsPrices);
    }

    function getFullLoanStatus() public view returns (uint256[4] memory) {
        return [getTotalValue(), getDebt(), getHealthRatio(), isSolvent() ? uint256(1) : uint256(0)];
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
     * @dev This function uses the redstone-evm-connector
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
