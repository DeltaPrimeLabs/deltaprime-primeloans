// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

/**
 * @title IBorrowersRegistry
 * Keeps a registry of created trading accounts to verify their borrowing rights
 */
interface IStakingPositions {
    struct StakedPosition {
        bytes32 symbol;
        bytes4 balanceSelector;
        bytes4 unstakeSelector;
    }
}
