// SPDX-License-Identifier: MIT
// Modified version of Openzeppelin (OpenZeppelin Contracts v4.4.1 (security/ReentrancyGuard.sol)) ReentrancyGuard
// contract that uses keccak slots instead of the standard storage layout.

import {DiamondStorageLib} from "./lib/DiamondStorageLib.sol";
import "./lib/SolvencyMethods.sol";
import "./facets/SmartLoanLiquidationFacet.sol";

pragma solidity 0.8.17;

/**
 * @dev Enforces ownership only if there is no liquidation ongoing
 */
abstract contract OnlyOwnerOrInsolvent is SolvencyMethods {

    /**
     * @dev Enforces ownership only if there is no liquidation ongoing
     */
    modifier onlyOwnerOrInsolvent() {
        bool wasSolvent = _isSolvent();
        if (wasSolvent) {
            DiamondStorageLib.enforceIsContractOwner();
        } else {
            require(SmartLoanLiquidationFacet(DeploymentConstants.getDiamondAddress()).isLiquidatorWhitelisted(msg.sender), "Only whitelisted accounts can perform this action");
        }

        _;

        if (wasSolvent) {
            require(_isSolvent(), "Must stay solvent");
        }
    }
}
