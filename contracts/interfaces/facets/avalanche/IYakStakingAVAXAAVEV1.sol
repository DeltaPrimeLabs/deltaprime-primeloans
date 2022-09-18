// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IYakStakingAVAXAAVEV1 {
    function totalDeposits() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function withdraw(uint256 amount) external;

    function depositFor(address account) external payable;

    function deposit() external payable;

    function decimals() external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);
}