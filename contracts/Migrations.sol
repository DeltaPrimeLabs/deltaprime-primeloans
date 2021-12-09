// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * Migrations
 * A helper contract to manage truffle migrations
 **/
contract Migrations {
  address public owner;
  uint256 public last_completed_migration;

  constructor() {
    owner = msg.sender;
  }

  modifier restricted() {
    if (msg.sender == owner) _;
  }

  function setCompleted(uint256 completed) public restricted {
    last_completed_migration = completed;
  }
}
