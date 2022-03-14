// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

/**
 * @title DestructableContract
 * @dev For tests
 */
contract DestructableContract {
  fallback() external payable {
    //just receive funds
  }

  function destruct(address payable receiverOfFunds) public {
    selfdestruct(receiverOfFunds);
  }
}
