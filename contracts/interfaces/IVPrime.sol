// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.17;


interface IVPrime {
    struct Checkpoint {
        uint32 blockTimestamp;
        uint256 balance;
        int256 rate; // Tokens per second
        uint256 balanceLimit;
    }

    function balanceOf(address account) external view returns (uint256);

    function checkpoints(address account, uint32 pos) external view returns (Checkpoint memory);

    /**
     * @dev Get number of checkpoints for `account`.
     */
    function numCheckpoints(address account) external view returns (uint32);
}
