// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: abc6cea589527b5b056d9754bdb215cb9014b9d2;
pragma solidity ^0.8.4;
import "../SmartLoan.sol";

contract SmartLoanLimitedCollateral is SmartLoan {

   /**
    * Funds a loan with the value attached to the transaction
    * Allows to add up to 7 AVAX of collateral in total
   **/
    function fund() public override payable {
        uint256 debt = getDebt();
        uint256 totalValue = getTotalValue();
        if (totalValue > debt) {
            require(totalValue - debt <= 6 ether, "Adding more collateral than 6 AVAX in total is not allowed");
        }
        super.fund();
    }
}
