// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "../CompoundingIndex.sol";


/**
 * @title CompoundingIndexFactory
 * @dev Contract factory allowing anyone to deploy a compounding index contract
 */
contract CompoundingIndexFactory {
  function deployIndex(address owner_) public {
    CompoundingIndex index = new CompoundingIndex(owner_);
    emit IndexDeployed(address(index));
  }

  /**
   * @dev emitted after compounding index is deployed by any user
   * @param indexAddress of deployed compounding index contract
   **/
  event IndexDeployed(address indexAddress);
}