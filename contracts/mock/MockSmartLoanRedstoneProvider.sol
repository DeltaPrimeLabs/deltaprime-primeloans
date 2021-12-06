// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "../SmartLoan.sol";


/**
 * @title MockSmartLoanRedstoneProvider
 * A contract that overrides Redstone-Avalanche provider to the default one for test purposes (mockLite) uses default
 *
 */
contract MockSmartLoanRedstoneProvider is SmartLoan {

  /**
   * Override trustedSigner getter for safety reasons
  **/
  function getTrustedSigner() override virtual public view returns (address) {
    return 0xFE71e9691B9524BC932C23d0EeD5c9CE41161884; //redstone-provider;
  }
}
