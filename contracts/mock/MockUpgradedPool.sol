// SPDX-License-Identifier: UNLICENSED
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
    function deposit() payable override external {
      _accumulateDepositInterest(msg.sender);

      _mint(msg.sender, msg.value * 2);
      _updateRates();

      emit Deposit(msg.sender, msg.value, block.timestamp);
    }


}
