interface ISmartLoanLiquidationFacet {
  function liquidateLoan ( uint256[] memory _amountsToRepay, uint256 _liquidationBonus ) payable external;
  function unsafeLiquidateLoan ( uint256[] memory _amountsToRepay, uint256 _liquidationBonus ) payable external;
}
