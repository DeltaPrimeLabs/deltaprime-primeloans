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

  function isTimestampValid(uint256 _receivedTimestamp) public override view returns (bool) {
    // Getting data timestamp from future seems quite unlikely
    // But we've already spent too much time with different cases
    // Where block.timestamp was less than dataPackage.timestamp.
    // Some blockchains may case this problem as well.
    // That's why we add MAX_BLOCK_TIMESTAMP_DELAY
    // and allow data "from future" but with a small delay

    // For TESTING purposes we allow timestamps up to 5 minutes in the future to accommodate for the re-compilation time
    require(
      (block.timestamp + 5 * 60) > _receivedTimestamp,
      "Data with timestamps more than 5 minutes in the future is not allowed");

    return block.timestamp < _receivedTimestamp
    || block.timestamp - _receivedTimestamp < MAX_DATA_TIMESTAMP_DELAY;
  }
}
