// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "./MockSmartLoanRedstoneProvider.sol";

/**
 * @title MockUpgradedSmartLoan
 * @dev A mock implementation of a SmartLoan to check if upgrade mechanism correctly update contract logic
 */
contract MockSmartLoan is MockSmartLoanRedstoneProvider {
  uint256 debt = 777;
  uint256 value = 999;

  function setDebt(uint256 _newDebt) public {
    debt = _newDebt;
  }

  function setValue(uint256 _newValue) public {
    value = _newValue;
  }

  /**
   * Dummy implementation used to test SmartLoan LTV logic
   **/
  function getTotalValue() public view override returns (uint256) {
    return value;
  }

  function getDebt() public view override returns (uint256) {
    return debt;
  }
}
