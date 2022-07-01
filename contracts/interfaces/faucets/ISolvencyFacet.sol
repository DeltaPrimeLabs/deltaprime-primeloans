interface ISolvencyFacet {
  function calculateAssetsValue (  ) external view returns ( uint256 );
  function calculateDebt (  ) external view returns ( uint256 );
  function calculateLTV (  ) external view returns ( uint256 );
  function calculateTotalValue (  ) external view returns ( uint256 );
  function getDebt (  ) external view returns ( uint256 );
  function getFullLoanStatus (  ) external returns ( uint256[4] memory );
  function getLTV (  ) external view returns ( uint256 );
  function getTotalValue (  ) external view returns ( uint256 );
  function isSolvent (  ) external view returns ( bool );
}
