// SPDX-License-Identifier: UNLICENSED
// Last deployed using commit: ;
pragma solidity ^0.8.4;

import "./MockSmartLoanRedstoneProvider.sol";

/**
 * @title SmartLoan
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */
contract MockUpgradedSolvencySmartLoan is MockSmartLoanRedstoneProvider {
  function getMaxLtv() override public pure returns(uint256) {
    return 200;
  }
}
