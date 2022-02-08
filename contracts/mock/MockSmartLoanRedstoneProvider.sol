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
  function getPriceProvider1() public view virtual override returns (address) {
    return 0xFE71e9691B9524BC932C23d0EeD5c9CE41161884; //redstone-provider;
  }

  function executeGetAllAssetsPrices() public returns (uint256[] memory) {
    return getAllAssetsPrices();
  }


  function executeGetTotalValue() public virtual returns (uint256) {
    return getTotalValue();
  }
}
