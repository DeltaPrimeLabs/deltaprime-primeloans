// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

interface IRewardRouterV2 {
    function claimFees() external;
    function feeGlpTracker() external view returns (address);
}