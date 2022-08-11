interface ISmartLoanLiquidationFacet {
  struct AssetAmountPair {
    bytes32 asset;
    uint256 amount;
  }
  function liquidateLoan ( AssetAmountPair[] memory _assetsAmountsToRepay, uint256 _liquidationBonus ) payable external;
  function unsafeLiquidateLoan ( AssetAmountPair[] memory _assetsAmountsToRepay, uint256 _liquidationBonus ) payable external;
}
