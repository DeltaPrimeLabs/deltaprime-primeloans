// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../lib/SolvencyMethodsLib.sol";
import "../Pool.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract SmartLoanViewFacet is ReentrancyGuardKeccak, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    struct AssetNameBalance {
        bytes32 name;
        uint256 balance;
    }

    struct AssetNameDebt {
        bytes32 name;
        uint256 debt;
    }

    struct AssetNamePrice {
        bytes32 name;
        uint256 price;
    }

    /* ========== PUBLIC AND EXTERNAL MUTATIVE FUNCTIONS ========== */

    function initialize(address owner) external {
        require(owner != address(0), "Initialize: Cannot set the owner to a zero address");

        DiamondStorageLib.SmartLoanStorage storage sls = DiamondStorageLib.smartLoanStorage();
        require(!sls._initialized, "DiamondInit: contract is already initialized");
        DiamondStorageLib.setContractOwner(owner);
        sls._initialized = true;
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getPercentagePrecision() public view virtual returns (uint256) {
        return DeploymentConstants.getPercentagePrecision();
    }


    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) public view returns (uint256) {
        IERC20 token = IERC20(DeploymentConstants.getTokenManager().getAssetAddress(_asset, true));
        return token.balanceOf(address(this));
    }

    function getAllOwnedAssets() external view returns (bytes32[] memory result) {
        return DeploymentConstants.getAllOwnedAssets();
    }

    function getSupportedTokensAddresses() external view returns (address[] memory) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        return tokenManager.getSupportedTokensAddresses();
    }

    function getAllAssetsBalances() public view returns (AssetNameBalance[] memory) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory assets = tokenManager.getAllTokenAssets();
        AssetNameBalance[] memory result = new AssetNameBalance[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            result[i] = AssetNameBalance({
            name : assets[i],
            balance : IERC20(tokenManager.getAssetAddress(assets[i], true)).balanceOf(address(this))
            });
        }

        return result;
    }

    function getDebts() public view returns (AssetNameDebt[] memory) {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory assets = tokenManager.getAllPoolAssets();
        AssetNameDebt[] memory result = new AssetNameDebt[](assets.length);

        for (uint256 i = 0; i < assets.length; i++) {
            Pool pool = Pool(tokenManager.getPoolAddress(assets[i]));

            result[i] = AssetNameDebt({
            name : assets[i],
            debt : pool.getBorrowed(address(this))
            });
        }

        return result;
    }

    /**
     * Returns the prices of all assets supported by the TokenManager
     * It could be used as a helper method for UI
     * @dev This function uses the redstone-evm-connector
     **/
    function getAllAssetsPrices() public view returns (AssetNamePrice[] memory) {
        bytes32[] memory assets = DeploymentConstants.getTokenManager().getAllTokenAssets();
        uint256[] memory prices = SolvencyMethodsLib.executeGetPricesFromMsg(assets);
        AssetNamePrice[] memory result = new AssetNamePrice[](assets.length);
        for (uint i = 0; i < assets.length; i++) {
            result[i] = AssetNamePrice({
            name : assets[i],
            price : prices[i]
            });
        }
        return result;
    }

    /* ========== MODIFIERS ========== */

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}