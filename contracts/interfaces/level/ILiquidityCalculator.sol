// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ILiquidityCalculator {
    function getTrancheValue(address _tranche, bool _max) external view returns (uint256);
}
