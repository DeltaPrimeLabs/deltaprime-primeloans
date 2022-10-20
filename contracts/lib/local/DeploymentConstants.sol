// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "../../TokenManager.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../RedstoneConfigManager.sol";

/**
 * DeploymentConstants
 * These constants are updated during test and prod deployments using JS scripts. Defined as constants
 * to decrease gas costs. Not meant to be updated unless really necessary.
 * BE CAREFUL WHEN UPDATING. CONSTANTS CAN BE USED AMONG MANY FACETS.
 **/
library DeploymentConstants {

    // Used for LiquidationBonus calculations
    uint256 private constant _PERCENTAGE_PRECISION = 1000;

    bytes32 private constant _NATIVE_TOKEN_SYMBOL = 'AVAX';

    address private constant _NATIVE_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x0ed64d01D0B4B655E410EF1441dD677B695639E7;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0x9385556B571ab92bf6dC9a0DbD75429Dd4d56F91;

    address private constant _TOKEN_MANAGER_ADDRESS = 0xa6e99A4ED7498b3cdDCBB61a6A607a4925Faa1B7;

    address private constant _REDSTONE_CONFIG_MANAGER_ADDRESS = 0x40918Ba7f132E0aCba2CE4de4c4baF9BD2D7D849;

    //implementation-specific

    function getPercentagePrecision() internal view returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    //blockchain-specific

    function getNativeTokenSymbol() internal pure returns (bytes32 symbol) {
        return _NATIVE_TOKEN_SYMBOL;
    }

    function getNativeToken() internal view returns (address payable) {
        return payable(_NATIVE_ADDRESS);
    }

    //deployment-specific

    function getDiamondAddress() internal view returns (address) {
        return _DIAMOND_BEACON_ADDRESS;
    }

    function getSmartLoansFactoryAddress() internal view returns (address) {
        return _SMART_LOANS_FACTORY_ADDRESS;
    }

    function getTokenManager() internal view returns (TokenManager) {
        return TokenManager(_TOKEN_MANAGER_ADDRESS);
    }

    function getRedstoneConfigManager() internal view returns (RedstoneConfigManager) {
        return RedstoneConfigManager(_REDSTONE_CONFIG_MANAGER_ADDRESS);
    }

    /**
    * Returns all owned assets keys
    **/
    function getAllOwnedAssets() internal view returns (bytes32[] memory result) {
        DiamondStorageLib.SmartLoanStorage storage sls = DiamondStorageLib.smartLoanStorage();
        return sls.ownedAssets._inner._keys._inner._values;
    }
}