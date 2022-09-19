// SPDX-License-Identifier: MIT
// Modified version of Openzeppelin (OpenZeppelin Contracts v4.4.1 (security/ReentrancyGuard.sol)) ReentrancyGuard
// contract that uses keccak slots instead of the standard storage layout.

import {DiamondStorageLib} from "./lib/DiamondStorageLib.sol";
import "./lib/SolvencyMethodsLib.sol";

pragma solidity ^0.8.0;

/**
 * @dev Enforces ownership only if there is no liquidation ongoing
 */
abstract contract OnlyOwnerOrInsolvent is SolvencyMethodsLib {

    /**
     * @dev Enforces ownership only if there is no liquidation ongoing
     */
    modifier onlyOwnerOrInsolvent() {
        bool wasSolvent = _isSolvent();
        if (wasSolvent) {
            DiamondStorageLib.enforceIsContractOwner();
        }

        _;

        if (wasSolvent) {
            require(_isSolvent(), "Must stay solvent");
        }
    }
}
