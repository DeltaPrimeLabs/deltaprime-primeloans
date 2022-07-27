interface ISmartLoanLiquidationFacet {
  function liquidateLoan ( uint256[] memory _amountsToRepay, uint256 _liquidationBonus ) external;
  function unsafeLiquidateLoan ( uint256[] memory _amountsToRepay, uint256 _liquidationBonus ) external;
}
