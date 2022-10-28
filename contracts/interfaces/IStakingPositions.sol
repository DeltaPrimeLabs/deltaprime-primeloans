// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

/**
 * @title IStakingPositions
 * Types for staking
 */
interface IStakingPositions {
    struct StakedPosition {
        bytes32 id;
        bytes32 symbol;
        bytes4 balanceSelector;
        bytes4 unstakeSelector;
    }
}
