// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "../../interfaces/ITokenManager.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

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

    address private constant _DIAMOND_BEACON_ADDRESS = 0x821f3361D454cc98b7555221A06Be563a7E2E0A6;

    address private constant _SMART_LOANS_FACTORY_ADDRESS = 0xC66AB83418C20A65C3f8e83B3d11c8C3a6097b6F;

    address private constant _TOKEN_MANAGER_ADDRESS = 0xe70f935c32dA4dB13e7876795f1e175465e6458e;

    address private constant _ADDRESS_PROVIDER = 0x2Dd78Fd9B8F40659Af32eF98555B8b31bC97A351;

    address private constant _FEES_TREASURY_ADDREESS = 0x764a9756994f4E6cd9358a6FcD924d566fC2e666;

    address private constant _STABILITY_POOL_ADDREESS = 0x6B9836D18978a2e865A935F12F4f958317DA4619;

    //implementation-specific

    function getPercentagePrecision() internal pure returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    //blockchain-specific

    function getNativeTokenSymbol() internal pure returns (bytes32 symbol) {
        return _NATIVE_TOKEN_SYMBOL;
    }

    function getNativeToken() internal pure returns (address payable) {
        return payable(_NATIVE_ADDRESS);
    }

    //deployment-specific

    function getDiamondAddress() internal pure returns (address) {
        return _DIAMOND_BEACON_ADDRESS;
    }

    function getSmartLoansFactoryAddress() internal pure returns (address) {
        return _SMART_LOANS_FACTORY_ADDRESS;
    }

    function getTokenManager() internal pure returns (ITokenManager) {
        return ITokenManager(_TOKEN_MANAGER_ADDRESS);
    }

    function getAddressProvider() internal pure returns (address) {
        return _ADDRESS_PROVIDER;
    }

    function getTreasuryAddress() internal pure returns (address) {
        return _FEES_TREASURY_ADDREESS;
    }

    function getStabilityPoolAddress() internal pure returns (address) {
        return _STABILITY_POOL_ADDREESS;
    }

    /**
    * Returns all owned assets keys
    **/
    function getAllOwnedAssets() internal view returns (bytes32[] memory result) {
        DiamondStorageLib.SmartLoanStorage storage sls = DiamondStorageLib.smartLoanStorage();
        return sls.ownedAssets._inner._keys._inner._values;
    }
}