// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "../upgraded/SmartLoanLimitedCollateral.sol";

/**
 * @title MockSmartLoanRedstoneProvider
 * A contract that overrides Redstone-Avalanche provider to the default one for test purposes (mockLite) uses default
 *
 */
contract MockSmartLoanRedstoneProviderLimitedCollateral is SmartLoanLimitedCollateral {
  /**
   * Override trustedSigner getter for safety reasons
   **/
  function getPriceProvider1() public view virtual override returns (address) {
    return 0xFE71e9691B9524BC932C23d0EeD5c9CE41161884; //redstone-provider;
  }
//
//  function executeGetAllAssetsPrices() public returns (uint256[] memory) {
////    return getAllAssetsPrices();
//    return [1,2];
//  }
//
//
//  function executeGetTotalValue() public virtual returns (uint256) {
////    return getTotalValue();
//    return 0;
//  }

  function getMaxBlockTimestampDelay() public virtual override view returns (uint256) {
    return 5 * 60;
  }
}
