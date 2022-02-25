// SPDX-License-Identifier: UNLICENSED
// Last deployed using commit: ;
pragma solidity ^0.8.4;
import "../SmartLoan.sol";

contract SLLowerLTV is SmartLoan{
    function getMaxBlockTimestampDelay() public override view returns (uint256) {
        return 300000;
    }

    function getMaxLtv() public override view returns (uint256) {
        return 2050;
    }

    function getMinSelloutLtv() public override view returns (uint256) {
        return 1900;
    }
}
