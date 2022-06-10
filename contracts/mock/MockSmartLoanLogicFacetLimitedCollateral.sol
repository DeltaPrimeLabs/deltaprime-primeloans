pragma solidity ^0.8.4;

import "./MockSmartLoanLogicFacetRedstoneProvider.sol";

contract MockSmartLoanLogicFacetLimitedCollateral is MockSmartLoanLogicFacetRedstoneProvider {
    /**
      * Funds a loan with the value attached to the transaction
      * Allows to add up to 500 USD of collateral in total
      * @dev This function uses the redstone-evm-connector
    **/
    function fund(bytes32 fundedAsset, uint256 _amount) public override {
        super.fund(fundedAsset, _amount);

        bytes32[] memory assets = SmartLoanLib.getExchange().getAllAssets();
        uint256[] memory prices = getPricesFromMsg(assets);

        uint256 debt = LTVLib.calculateDebt(prices);
        uint256 totalValue = LTVLib.calculateAssetsValue(prices);

        if (totalValue > debt) {
            require(totalValue - debt <= 500 * 10**18, "Adding more collateral than 500 USD in total is not allowed");
        }
    }
}