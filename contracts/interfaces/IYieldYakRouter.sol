// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

interface IYieldYakRouter {
    function stakeAVAX(uint256 amount) payable external;

    function unstakeAVAX(uint256 amount) external returns(bool);

    function getTotalStakedValue() external view returns (uint256 totalValue);

    function unstakeAVAXForASpecifiedAmount(uint256 amount) external;
}
