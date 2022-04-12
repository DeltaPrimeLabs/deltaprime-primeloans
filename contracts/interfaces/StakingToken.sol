// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface StakingToken is IERC20 {
    function withdraw(uint256 amount) external;

    function totalDeposits() external view returns(uint256);

    function depositFor(address account) external payable;
}