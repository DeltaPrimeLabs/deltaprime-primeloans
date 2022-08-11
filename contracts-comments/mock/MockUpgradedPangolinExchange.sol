// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "../UniswapV2Exchange.sol";

contract MockUpgradedPangolinExchange is UniswapV2Exchange{
    /**
   * Returns a mocked 1337 value;
   **/
    function newMockedFunction() public view returns (uint256) {
        return 1337;
    }
}
