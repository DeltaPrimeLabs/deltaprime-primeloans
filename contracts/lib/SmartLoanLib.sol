pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAssetsExchange.sol";
import "../Pool.sol";
import "../PoolManager.sol";
import "../interfaces/IYieldYakRouter.sol";
import {LibDiamond} from "../lib/LibDiamond.sol";
import "../Pool.sol";
import "../RedstoneConfigManager.sol";

library SmartLoanLib {

    uint256 private constant _PERCENTAGE_PRECISION = 1000;
    // 5%
    uint256 private constant _MAX_LIQUIDATION_BONUS = 50;
    // 500%
    uint256 private constant _MAX_LTV = 5000;
    // 400%
    uint256 private constant _MIN_SELLOUT_LTV = 4000;

    address private constant _POOL_ADDRESS = 0x5ff1DE6091871adAAe64E2Ec4feD754628482868;

    // TODO: Remove after using RestoneConfigManager on production
    // redstone-evm-connector price providers
    address private constant _PRICE_PROVIDER_1 = 0x981bdA8276ae93F567922497153de7A5683708d3;

    address private constant _PRICE_PROVIDER_2 = 0x3BEFDd935b50F172e696A5187DBaCfEf0D208e48;

    address private constant _NATIVE_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x8198f5d8F8CfFE8f9C413d98a0A55aEB8ab9FbB7;

    // redstone-evm-connector max block.timestamp acceptable delay
    uint256 internal constant MAX_BLOCK_TIMESTAMP_DELAY = 30; // 30 seconds

    function getDiamondAddress() internal view returns (address) {
        return _DIAMOND_BEACON_ADDRESS;
    }

    function getPercentagePrecision() internal view returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    function getMaxLiquidationBonus() internal view returns (uint256) {
        return _MAX_LIQUIDATION_BONUS;
    }

    function getMaxLtv() internal view returns (uint256) {
        return _MAX_LTV;
    }

    function getMinSelloutLtv() internal view returns (uint256) {
        return _MIN_SELLOUT_LTV;
    }

    function getPoolManager() internal view returns (PoolManager) {
    return PoolManager(0x51A1ceB83B83F1985a81C295d1fF28Afef186E02);
    }

    function getNativeTokenSymbol() internal pure returns (bytes32[] memory symbol) {
        symbol = new bytes32[](1);
        symbol[0] = "AVAX";
    }

    function getRedstoneConfigManager() internal view returns (RedstoneConfigManager) {
    return RedstoneConfigManager(0xdbC43Ba45381e02825b14322cDdd15eC4B3164E6);
    }

    function getNativeToken() internal view returns (address payable) {
        return payable(_NATIVE_ADDRESS);
    }

    function getMaxBlockTimestampDelay() internal view returns (uint256) {
        return MAX_BLOCK_TIMESTAMP_DELAY;
    }

    function getPriceProvider1() internal view returns (address) {
        return _PRICE_PROVIDER_1;
    }

    function getPriceProvider2() internal view returns (address) {
        return _PRICE_PROVIDER_2;
    }

    function getLiquidationInProgress() internal view returns (bool) {
        LibDiamond.LiquidationStorage storage ls = LibDiamond.liquidationStorage();
        return ls._liquidationInProgress;
    }

    function setLiquidationInProgress(bool _status) internal {
        LibDiamond.LiquidationStorage storage ls = LibDiamond.liquidationStorage();
        ls._liquidationInProgress = _status;
    }

    /**
    * Returns all owned assets keys
    **/
    function getAllOwnedAssets() internal view returns (bytes32[] memory result) {
        LibDiamond.SmartLoanStorage storage sls = LibDiamond.smartLoanStorage();
        return sls.ownedAssets._inner._keys._inner._values;
    }
}