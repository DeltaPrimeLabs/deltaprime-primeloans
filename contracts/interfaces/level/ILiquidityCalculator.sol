// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ILiquidityCalculator {
    function getTrancheValue(address _tranche, bool _max) external view returns (uint256);

    function calcAddRemoveLiquidityFee(address _token, uint256 _tokenPrice, uint256 _valueChange, bool isAdd) external view returns (uint256);
}
