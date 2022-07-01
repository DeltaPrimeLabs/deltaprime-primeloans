interface ISmartLoanLogicFacet {
  function depositNativeToken (  ) external;
  function getMaxLiquidationBonus (  ) external view returns ( uint256 );
  function getMaxLtv (  ) external view returns ( uint256 );
  function getOwnedAssetsBalances (  ) external view returns ( uint256[] memory );
  function getOwnedAssetsPrices (  ) external view returns ( uint256[] memory );
  function getPercentagePrecision (  ) external view returns ( uint256 );
  function wrapNativeToken ( uint256 amount ) external;
}
