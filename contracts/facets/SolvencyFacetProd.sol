// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../oracle/RSOracleProd3Signers.sol";
import "../TokenManager.sol";
import "../Pool.sol";
import "../DiamondHelper.sol";
import "../interfaces/IStakingPositions.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract SolvencyFacetProd is RSOracleProd3Signers, DiamondHelper {
    struct AssetPrice {
        bytes32 asset;
        uint256 price;
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
    function isSolventWithPrices(AssetPrice[] memory assetsPrices, AssetPrice[] memory assetsPricesDebt) public view returns (bool) {
        return getHealthRatioWithPrices(assetsPrices, assetsPricesDebt) >= 1e18;
    }

    function getPrices(bytes32[] memory symbols) external view returns (uint256[] memory) {
        return getOracleNumericValuesFromTxMsg(symbols);
    }

    function getPrice(bytes32 symbol) external view returns (uint256) {
        return getOracleNumericValueFromTxMsg(symbol);
    }

    function getDebtWithPrices(AssetPrice[] memory assetsPrices) public view virtual returns (uint256) {
        return getDebtBase(assetsPrices);
    }

    function getDebtBase(AssetPrice[] memory assetsPrices) internal view returns (uint256){
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 debt = 0;

        for (uint256 i = 0; i < assetsPrices.length; i++) {
            IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assetsPrices[i].asset, true));

            Pool pool = Pool(tokenManager.getPoolAddress(assetsPrices[i].asset));
            //10**18 (wei in eth) / 10**8 (precision of oracle feed) = 10**10
            debt = debt + pool.getBorrowed(address(this)) * assetsPrices[i].price * 10 ** 10
            / 10 ** token.decimals();
        }

        return debt;
    }

    /**
   * Returns the current debt from all lending pools
   * @dev This function uses the redstone-evm-connector
   **/
    function getDebt() public view virtual returns (uint256) {
        AssetPrice[] memory assetsPrices = getAssetsPricesDebt();
        return getDebtBase(assetsPrices);
    }

    function getTotalAssetsValueWithPrices(AssetPrice[] memory assetsPrices) public view virtual returns (uint256) {
        return _getTotalAssetsValueBase(assetsPrices);
    }

    function _getTotalAssetsValueBase(AssetPrice[] memory assetsPrices) public view returns (uint256) {
        if (assetsPrices.length > 0) {
            TokenManager tokenManager = DeploymentConstants.getTokenManager();

            uint256 total = address(this).balance * assetsPrices[0].price / 10 ** 8;

            for (uint256 i = 0; i < assetsPrices.length; i++) {
                require(assetsPrices[i].price != 0, "Asset price returned from oracle is zero");

                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assetsPrices[i].asset, true));
                uint256 assetBalance = token.balanceOf(address(this));

                total = total + (assetsPrices[i].price * 10 ** 10 * assetBalance / (10 ** token.decimals()));
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
        AssetPrice[] memory assetsPrices = getAssetsPrices();
        return _getTotalAssetsValueBase(assetsPrices);
    }



    function getAssetsPricesDebt() public view returns(AssetPrice[] memory) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory assets = tokenManager.getAllPoolAssets();
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assets);

        AssetPrice[] memory result = new AssetPrice[](prices.length);

        for(uint256 i=0; i<assets.length; i++){
            result[i] = AssetPrice({
            asset: assets[i],
            price: prices[i]
            });
        }

        return result;
    }

    function getAssetsPrices() public view returns(AssetPrice[] memory) {
        bytes32[] memory assets = DeploymentConstants.getAllOwnedAssets();
        bytes32 nativeToken = DeploymentConstants.getNativeTokenSymbol();
        bool hasNativeToken = DiamondStorageLib.hasAsset(nativeToken);

        uint256 numberOfAssets;
        if(hasNativeToken){
            numberOfAssets = assets.length;
        } else {
            numberOfAssets = assets.length + 1;
        }

        AssetPrice[] memory result = new AssetPrice[](numberOfAssets);
        bytes32[] memory assetsEnriched = new bytes32[](numberOfAssets);

        uint256 lastUsedIndex = 0;
        assetsEnriched[0] = nativeToken; // First asset = NativeToken
        for(uint i=0; i<assets.length; i++){
            if(assets[i] != nativeToken){
                lastUsedIndex += 1;
                assetsEnriched[lastUsedIndex] = assets[i];
            }
        }

        uint256[] memory prices = getOracleNumericValuesFromTxMsg(assetsEnriched);

        for(uint256 i=0; i<numberOfAssets; i++){
            result[i] = AssetPrice({
                asset: assetsEnriched[i],
                price: prices[i]
            });
        }

        return result;
    }

    function _getThresholdWeightedValueBase(AssetPrice[] memory assetsPrices) public view virtual returns (uint256) {
        bytes32 nativeToken = DeploymentConstants.getNativeTokenSymbol();

        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256 weightedValueOfTokens;

        if (assetsPrices.length > 0) {
            // TODO: double check the decimals
            weightedValueOfTokens = assetsPrices[0].price * address(this).balance * tokenManager.maxTokenLeverage(tokenManager.getAssetAddress(nativeToken, true)) / (10 ** 26);

            for (uint256 i = 0; i < assetsPrices.length; i++) {
                require(assetsPrices[i].price != 0, "Asset price returned from oracle is zero");

                IERC20Metadata token = IERC20Metadata(tokenManager.getAssetAddress(assetsPrices[i].asset, true));
                weightedValueOfTokens = weightedValueOfTokens + (assetsPrices[i].price * 10 ** 10 * token.balanceOf(address(this)) * tokenManager.maxTokenLeverage(address(token)) / (10 ** token.decimals() * 1e18));
            }
        }

        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        bytes32[] memory symbols = new bytes32[](positions.length);
        for(uint256 i=0; i<positions.length; i++) {
            symbols[i] = positions[i].symbol;
        }

        uint256[] memory prices = getOracleNumericValuesWithDuplicatesFromTxMsg(symbols);

        uint256 weightedValueOfStaked;

        for (uint256 i; i < positions.length; i++) {
            require(prices[i] != 0, "Asset price returned from oracle is zero");

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));

            if (success) {
                uint256 balance = abi.decode(result, (uint256));

                IERC20Metadata token = IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(positions[i].symbol, true));

                weightedValueOfStaked += prices[i] * 10 ** 10 * balance * tokenManager.maxTokenLeverage(positions[i].vault) / (10 ** token.decimals());
            }
        }

        return weightedValueOfTokens + weightedValueOfStaked;
    }

    /**
     * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getThresholdWeightedValueWithPrices(AssetPrice[] memory assetsPrices) public view virtual returns (uint256) {
        return _getThresholdWeightedValueBase(assetsPrices);
    }


    /**
     * Returns the threshold weighted value of assets in USD including all tokens as well as staking and LP positions
     * @dev This function uses the redstone-evm-connector
     **/
    function getThresholdWeightedValue() public view virtual returns (uint256) {
        AssetPrice[] memory assetsPrices = getAssetsPrices();
        return _getThresholdWeightedValueBase(assetsPrices);
    }

    function getStakedValue() public view virtual returns (uint256) {
        IStakingPositions.StakedPosition[] storage positions = DiamondStorageLib.stakedPositions();

        uint256 usdValue;

        for (uint256 i; i < positions.length; i++) {
            //TODO: fetch multiple prices to reduce cost
            uint256 price = getOracleNumericValueFromTxMsg(positions[i].symbol);
            require(price != 0, "Asset price returned from oracle is zero");

            (bool success, bytes memory result) = address(this).staticcall(abi.encodeWithSelector(positions[i].balanceSelector));

            if (success) {
                uint256 balance = abi.decode(result, (uint256));

                IERC20Metadata token = IERC20Metadata(DeploymentConstants.getTokenManager().getAssetAddress(positions[i].symbol, true));

                usdValue += price * 10 ** 10 * balance / (10 ** token.decimals());
            }
        }

        return usdValue;
    }

    function getTotalValue() public view virtual returns (uint256) {
        return getTotalAssetsValue() + getStakedValue();
    }

    function getTotalValueWithPrices(AssetPrice[] memory assetsPrices) public view virtual returns (uint256) {
        return getTotalAssetsValueWithPrices(assetsPrices) + getStakedValue();
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
    function getHealthRatioWithPrices(AssetPrice[] memory assetsPrices, AssetPrice[] memory assetsPricesDebt) public view virtual returns (uint256) {
        uint256 debt = getDebtWithPrices(assetsPricesDebt);
        uint256 thresholdWeightedValue = getThresholdWeightedValueWithPrices(assetsPrices);

        if (debt == 0) {
            return type(uint256).max;
        } else {
            return thresholdWeightedValue * 1e18 / debt;
        }
    }
}
