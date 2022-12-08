pragma solidity ^0.8.17;

interface ISmartLoanLiquidationFacet {
  function _getLTV (  ) external returns ( uint256 ltv );
  function getMaxLiquidationBonus (  ) external view returns ( uint256 );
  function getMaxLtv (  ) external view returns ( uint256 );
  function getMinLtvAfterLiquidation (  ) external view returns ( uint256 );
  function getPrice ( bytes32 symbol ) external view returns ( uint256 price );
  function getPrices ( bytes32[] memory symbols ) external view returns ( uint256[] memory prices );
  function liquidateLoan ( bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus ) external;
  function unsafeLiquidateLoan ( bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus ) external;
  function whitelistLiquidators(address[] memory _liquidators) external;
  function delistLiquidators(address[] memory _liquidators) external;
  function isLiquidatorWhitelisted(address _liquidator) view external returns(bool);
}
