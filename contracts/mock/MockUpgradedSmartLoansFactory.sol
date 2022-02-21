// SPDX-License-Identifier: UNLICENSED
// Last deployed using commit: ;
pragma solidity ^0.8.4;

import "../SmartLoansFactory.sol";

contract MockUpgradedSmartLoansFactory is SmartLoansFactory{
    /**
   * Returns a mocked 1337 value;
   **/
    function newMockedFunction() public view returns (uint256) {
        return 1337;
    }
}
