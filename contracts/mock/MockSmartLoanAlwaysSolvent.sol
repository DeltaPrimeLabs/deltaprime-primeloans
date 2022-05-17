// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "./MockSmartLoanRedstoneProvider.sol";

/**
 * @title SmartLoan
 * Only for testing purposes.
 *
 */
contract MockSmartLoanAlwaysSolvent is MockSmartLoanRedstoneProvider {
  function getLTV() override public pure returns(uint256) {
    return 0;
  }
}
