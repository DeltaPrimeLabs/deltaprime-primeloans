import "../../faucets/SmartLoanLiquidationFacet.sol";

interface ISmartLoanLiquidationFacet {
  function liquidateLoan ( SmartLoanLiquidationFacet.AssetAmountPair[] memory _assetsAmountsToRepay, uint256 _liquidationBonus ) payable external;
  function unsafeLiquidateLoan ( SmartLoanLiquidationFacet.AssetAmountPair[] memory _assetsAmountsToRepay, uint256 _liquidationBonus ) payable external;
}
