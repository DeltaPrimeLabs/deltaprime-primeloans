// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "../Pool.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title MockUpgradedPool
 * @dev A mock implementation of a Pool to check if upgrade mechanism correctly update contrac logic
 */
contract MockUpgradedPool is Pool {
  /**
   * Dummy implementation recording double deposits
   * used to test upgrade of contract logic
   **/
  function deposit(uint256 amount) public override nonReentrant {
    _accumulateDepositInterest(msg.sender);

    _transferToPool(msg.sender, amount);

    //change to original deposit method
    _mint(msg.sender, amount * 2);
    _updateRates();

    emit Deposit(msg.sender, amount, block.timestamp);
  }
}
