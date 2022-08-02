interface ISmartLoanLogicFacet {
  function depositNativeToken (  ) payable external;
  function getAllAssetsBalances (  ) external view returns ( uint256[] memory );
  function getAllAssetsPrices (  ) external view returns ( uint256[] memory );
  function getBalance ( bytes32 _asset ) external view returns ( uint256 );
  function getMaxLiquidationBonus (  ) external view returns ( uint256 );
  function getMaxLtv (  ) external view returns ( uint256 );
  function getOwnedAssetsBalances (  ) external view returns ( uint256[] memory );
  function getOwnedAssetsPrices (  ) external view returns ( uint256[] memory );
  function getPercentagePrecision (  ) external view returns ( uint256 );
  function unwrapAndWithdraw ( uint256 _amount ) payable external;
  function wrapNativeToken ( uint256 amount ) external;
}
