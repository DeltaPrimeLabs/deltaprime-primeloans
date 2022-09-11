import "../../facets/SmartLoanViewFacet.sol";
interface ISmartLoanViewFacet {
  function getAllAssetsBalances (  ) external view returns ( SmartLoanViewFacet.AssetNameBalance[] memory );
  function getAllAssetsPrices (  ) external view returns ( SmartLoanViewFacet.AssetNamePrice[] memory );
  function getAllOwnedAssets (  ) external view returns ( bytes32[] memory result );
  function getSupportedTokensAddresses (  ) external view returns ( address[] memory result );
  function getBalance ( bytes32 _asset ) external view returns ( uint256 );
  function getPercentagePrecision (  ) external view returns ( uint256 );
  function initialize ( address owner ) external;
}
