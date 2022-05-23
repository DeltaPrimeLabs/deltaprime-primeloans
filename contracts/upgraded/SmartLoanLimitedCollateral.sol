// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 5b86a7816dc6329ebec86ebfc0c07cfaeb3a5117;
pragma solidity ^0.8.4;
import "../SmartLoan.sol";

contract SmartLoanLimitedCollateral is SmartLoan {

   /**
    * Funds a loan with the value attached to the transaction
    * Allows to add up to 20 AVAX of collateral in total
   **/
    function fund() public override payable {
        uint256 debt = getDebt();
        uint256 totalValue = getTotalValue();
        if (totalValue > debt) {
            require(totalValue - debt <= 20 ether, "Adding more collateral than 20 AVAX in total is not allowed");
        }
        super.fund();
    }
}
