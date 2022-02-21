// SPDX-License-Identifier: UNLICENSED
// Last deployed using commit: ;
pragma solidity ^0.8.4;

import "../PangolinExchange.sol";

contract MockUpgradedPangolinExchange is PangolinExchange{
    /**
   * Returns a mocked 1337 value;
   **/
    function newMockedFunction() public view returns (uint256) {
        return 1337;
    }
}
