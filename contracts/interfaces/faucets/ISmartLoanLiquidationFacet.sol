interface ISmartLoanLiquidationFacet {
  function closeLoan ( bytes32[] memory _assetsProvided, uint256[] memory _amountsProvided ) external;
  function liquidateLoan ( uint256[] memory _amountsToRepay, uint256 _liquidationBonus ) external;
  function unsafeLiquidateLoan ( uint256[] memory _amountsToRepay, uint256 _liquidationBonus ) external;
}
