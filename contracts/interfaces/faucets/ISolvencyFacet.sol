interface ISolvencyFacet {
  function getDebt (  ) external view returns ( uint256 );
  function executeGetPricesFromMsg ( bytes32[] memory  ) external view returns ( uint256[] memory );
  function getFullLoanStatus (  ) external returns ( uint256[4] memory );
  function getLTV (  ) external view returns ( uint256 );
  function getTotalValue (  ) external view returns ( uint256 );
  function isSolvent (  ) external view returns ( bool );
}
