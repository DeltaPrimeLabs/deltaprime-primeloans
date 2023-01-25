// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.17;

interface IYieldYakSwapFacet {
    function yakSwap(uint256 _amountIn, uint256 _amountOut, address[] calldata _path, address[] calldata _adapters) external;

    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);
}