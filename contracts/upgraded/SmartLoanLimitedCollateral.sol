// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 35ebfb682402531f7e4a19af109d58b3d731e627;
pragma solidity ^0.8.4;
import "../SmartLoan.sol";

contract SmartLoanLimitedCollateral is SmartLoan {

   /**
    * Funds a loan with the value attached to the transaction
    * Allows to add up to 7 AVAX of collateral in total
   **/
    function fund() public override payable {
        require(getTotalValue() - getDebt() <= 7 ether, "Adding more collateral than 7 AVAX in total is not allowed");
        super.fund();
    }
}
