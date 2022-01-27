// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./CompoundingIndex.sol";

/**
 * BorrowingIndex
 * Separated from CompoundingIndex for truffle migration
 **/
contract BorrowingIndex is CompoundingIndex {
    constructor(address owner_) CompoundingIndex(owner_){}
}
