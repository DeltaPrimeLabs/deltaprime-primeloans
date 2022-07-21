// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 648f5794d589d10ef8ef138b16697fb525ee9b24;
pragma solidity ^0.8.4;

import "../ERC20Pool.sol";


/**
 * @title PoolFactory
 * @dev Contract factory allowing anyone to deploy a pool contract
 */
contract PoolFactory {
  function deployPool() public {
    ERC20Pool pool = new ERC20Pool();
    emit PoolDeployed(address(pool));
  }

  /**
   * @dev emitted after pool is deployed by any user
   * @param poolAddress of deployed pool
   **/
  event PoolDeployed(address poolAddress);
}