import "../../facets/SmartLoanLiquidationFacet.sol";

interface ISmartLoanLiquidationFacet {
  function liquidateLoan ( bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus ) payable external;
  function unsafeLiquidateLoan ( bytes32[] memory assetsToRepay, uint256[] memory amountsToRepay, uint256 _liquidationBonus ) payable external;
}
