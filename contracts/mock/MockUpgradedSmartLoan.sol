// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../SmartLoan.sol";

/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract MockUpgradedSmartLoan is SmartLoan {
  function get_max_ltv() override public pure returns(uint256) {
    return 200;
  }

  function get_min_sellout_ltv() override public pure returns(uint256) {
    return 400;
  }

  function getTotalValue() override public pure returns (uint256) {
    return 777;
  }
}
