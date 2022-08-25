// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 648f5794d589d10ef8ef138b16697fb525ee9b24;
pragma solidity ^0.8.4;

import "./UsdcPool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract UsdcPoolFactory {
  function deployPool() public {
    UsdcPool pool = new UsdcPool();
    emit PoolDeployed(msg.sender, address(pool), block.timestamp);
  }

  /**
   * @dev emitted after pool is deployed by any user
   * @param user the address initiating the deployment
   * @param poolAddress of deployed pool
   * @param timestamp of the deployment
   **/
  event PoolDeployed(address user, address poolAddress, uint256 timestamp);
}