pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAware.sol";
import "../lib/SmartLoanConfigLib.sol";
import "../lib/SolvencyMethodsLib.sol";
import "./SolvencyFacet.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import { DiamondStorageLib } from "../lib/DiamondStorageLib.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Pool.sol";

contract SmartLoanLogicFacet is PriceAware, ReentrancyGuard, SolvencyMethodsLib {
    using TransferHelper for address payable;
    using TransferHelper for address;

    struct AssetNameBalance {
        bytes32 name;
        uint256 balance;
    }

    struct AssetNamePrice {
        bytes32 name;
        uint256 price;
    }

    /* ========== REDSTONE-EVM-CONNECTOR OVERRIDDEN FUNCTIONS ========== */

    /**
     * Override PriceAware method to consider Avalanche guaranteed block timestamp time accuracy
     **/
    function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
        return SmartLoanConfigLib.getRedstoneConfigManager().maxBlockTimestampDelay();
    }

    /**
     * Override PriceAware method, addresses below belong to authorized signers of data feeds
     **/
    function isSignerAuthorized(address _receivedSigner) public override virtual view returns (bool) {
        return SmartLoanConfigLib.getRedstoneConfigManager().signerExists(_receivedSigner);
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

    function getMaxLiquidationBonus() public view virtual returns (uint256) {
        return SmartLoanConfigLib.getMaxLiquidationBonus();
    }

    function getMaxLtv() public view virtual returns (uint256) {
        return SmartLoanConfigLib.getMaxLtv();
    }

    function getPercentagePrecision() public view virtual returns (uint256) {
        return SmartLoanConfigLib.getPercentagePrecision();
    }


    /**
    * Returns a current balance of the asset held by the smart loan
    * @param _asset the code of an asset
    **/
    function getBalance(bytes32 _asset) public view returns (uint256) {
        IERC20 token = IERC20(SmartLoanConfigLib.getTokenManager().getAssetAddress(_asset));
        return token.balanceOf(address(this));
    }

    function getAllOwnedAssets() external view returns (bytes32[] memory result) {
        return SmartLoanConfigLib.getAllOwnedAssets();
    }

    function getAllAssetsBalances() public view returns (AssetNameBalance[] memory) {
        TokenManager tokenManager = SmartLoanConfigLib.getTokenManager();
        bytes32[] memory assets = tokenManager.getAllTokenAssets();
        uint256[] memory balances = new uint256[](assets.length);
        AssetNameBalance[] memory result = new AssetNameBalance[](assets.length);

        for (uint256 i = 0; i<assets.length; i++) {
            result[i] = AssetNameBalance({
                name: assets[i],
                balance: IERC20(tokenManager.getAssetAddress(assets[i])).balanceOf(address(this))
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
        bytes32[] memory assets = SmartLoanConfigLib.getTokenManager().getAllTokenAssets();
        uint256[] memory prices = getPricesFromMsg(assets);
        AssetNamePrice[] memory result = new AssetNamePrice[](assets.length);
        for(uint i=0; i<assets.length; i++){
            result[i] = AssetNamePrice({
                name: assets[i],
                price: prices[i]
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