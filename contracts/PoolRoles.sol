// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.17;

contract PoolRoles {
    bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

    bytes32 public constant UNPAUSE_ROLE = keccak256("UNPAUSE_ROLE");

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
}
