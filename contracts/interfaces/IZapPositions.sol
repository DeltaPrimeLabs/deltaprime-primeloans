// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

/**
 * @title IZapPositions
 * Types for long/short
 */
interface IZapPositions {
    struct Position {
        bytes4 unstakeSelector;
        address fromAsset;
        bytes32 fromSymbol;
        address toAsset;
        uint256 fromAmount;
        uint256 toAmount;
    }
}
