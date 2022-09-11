// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWrappedNativeToken is IERC20 {

function receive() external payable;

function deposit() external payable;

function withdraw(uint256 wad) external;

}