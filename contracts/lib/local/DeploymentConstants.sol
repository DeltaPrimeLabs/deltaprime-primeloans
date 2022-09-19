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

    // Used for LTV (TotalValue, Debt) and LiquidationBonus calculations
    uint256 private constant _PERCENTAGE_PRECISION = 1000;

    bytes32 private constant _NATIVE_TOKEN_SYMBOL = 'AVAX';

    address private constant _NATIVE_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x6C2d83262fF84cBaDb3e416D527403135D757892;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0x4bf010f1b9beDA5450a8dD702ED602A104ff65EE;

    address private constant _TOKEN_MANAGER_ADDRESS = 0x02b0B4EFd909240FCB2Eb5FAe060dC60D112E3a4;

    address private constant _REDSTONE_CONFIG_MANAGER_ADDRESS = 0x976fcd02f7C4773dd89C309fBF55D5923B4c98a1;

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