// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/AccessControlDefaultAdminRules.sol";

/**
 * @title RoleManagement
 * @dev Contract for managing roles using AccessControlDefaultAdminRules
 */
contract PoolRoleManager is AccessControlDefaultAdminRules {
    // DEFAULT_ADMIN_ROLE must be assigned to a 24h timelock controlled by a multisig

    // PAUSE_ROLE must be assigned to both the DEFAULT ADMIN address as well as a hot wallet (for automated pausing)

    // UNPAUSE_ROLE must be assigned to both the DEFAULT ADMIN address as well as a 1hr timelock controlled by a multisig

    // OPERATOR_ROLE must be assigned to a 24h timelock controlled by a multisig (different than the one controlling DEFAULT_ADMIN_ROLE)

    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    bytes32 public constant UNPAUSE_ROLE = keccak256("UNPAUSE_ROLE");

    bytes32 public constant OPERATOR_ROLE = keccak256("SET_TOTAL_SUPPLY_CAP_ROLE");

    /**
     * @dev Constructor that sets up the default admin rules
     * @param adminTransferDelay The delay (in seconds) before an admin transfer is effective
     * @param initialAdmin The initial default admin address
     */
    constructor(uint48 adminTransferDelay, address initialAdmin, address pauseAdmin, address unpauseAdmin, address subcontractsOperator)
    AccessControlDefaultAdminRules(adminTransferDelay, initialAdmin)
    {
        // PAUSE ROLE
        _grantRole(PAUSE_ROLE, initialAdmin);
        _grantRole(PAUSE_ROLE, pauseAdmin);

        // UNPAUSE ROLE
        _grantRole(UNPAUSE_ROLE, initialAdmin);
        _grantRole(UNPAUSE_ROLE, unpauseAdmin);

        // SUBCONTRACTS OPERATOR ROLE
        _grantRole(OPERATOR_ROLE, subcontractsOperator);
    }
}