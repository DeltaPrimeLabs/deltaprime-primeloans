// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./CompoundingIndex.sol";

/**
 * DepositIndex
 * Separated from CompoundingIndex for truffle migration
 **/
contract DepositIndex is CompoundingIndex {
  constructor(address owner_) CompoundingIndex(owner_){}
}
