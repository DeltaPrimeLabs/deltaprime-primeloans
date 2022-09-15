// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

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

    // Used for LTV (TotalValue, Debt) and LiquidationBonus calculations
    uint256 private constant _PERCENTAGE_PRECISION = 1000;

    bytes32 private constant _NATIVE_TOKEN_SYMBOL = 'AVAX';

    address private constant _NATIVE_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x4CF4dd3f71B67a7622ac250f8b10d266Dc5aEbcE;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0xE2b5bDE7e80f89975f7229d78aD9259b2723d11F;

    address private constant _TOKEN_MANAGER_ADDRESS = 0x3abBB0D6ad848d64c8956edC9Bf6f18aC22E1485;

    address private constant _REDSTONE_CONFIG_MANAGER_ADDRESS = 0x0bF7dE8d71820840063D4B8653Fd3F0618986faF;

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