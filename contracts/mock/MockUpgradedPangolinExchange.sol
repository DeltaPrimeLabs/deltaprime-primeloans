// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../PangolinExchange.sol";

contract MockUpgradedPangolinExchange is PangolinExchange{
    /**
   * Returns a mocked 1337 value;
   **/
    function getEstimatedAVAXForERC20Token(uint256 _exactAmountOut, address _token) override public view returns (uint256) {
        return 1337;
    }
}
