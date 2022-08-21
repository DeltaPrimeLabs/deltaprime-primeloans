import "../../faucets/SmartLoanLogicFacet.sol";

interface ISmartLoanLogicFacet {
  function getAllAssetsBalances (  ) external view returns ( SmartLoanLogicFacet.AssetNameBalance[] memory  );
  function getAllAssetsPrices (  ) external view returns ( SmartLoanLogicFacet.AssetNamePrice[] memory );
  function wrapNativeToken( uint256 amount ) external;
  function depositNativeToken( ) payable external;
  function unwrapAndWithdraw ( uint256 amount ) payable external;
  function getAllOwnedAssets (  ) external view returns ( bytes32[] memory result );
  function getBalance ( bytes32 _asset ) external view returns ( uint256 );
  function getMaxLiquidationBonus (  ) external view returns ( uint256 );
  function getMaxLtv (  ) external view returns ( uint256 );
  function getPercentagePrecision (  ) external view returns ( uint256 );
  function initialize ( address owner ) external;
}
