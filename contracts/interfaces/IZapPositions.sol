// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

/**
 * @title IZapPositions
 * Types for long/short
 */
interface IZapPositions {
    struct Position {
        uint256 startAmount;
        address asset;
        bytes32 symbol;
        bytes32 identifier;
        uint256 amount;
    }
}
