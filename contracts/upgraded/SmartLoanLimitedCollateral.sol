// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 35ebfb682402531f7e4a19af109d58b3d731e627;
pragma solidity ^0.8.4;
import "../SmartLoan.sol";

contract SmartLoanLimitedCollateral is SmartLoan {
    using TransferHelper for address payable;

    bytes32 internal constant COLLATERAL_SUM_SLOT = bytes32(uint256(keccak256('COLLATERAL_SUM')) - 1);

   /**
    * Funds a loan with the value attached to the transaction
    * Allows to add up to 7 AVAX of collateral in total
   **/
    function fund() public override payable {
        bytes32 slot = COLLATERAL_SUM_SLOT;
        uint256 collateralSum;

        assembly {
            collateralSum := sload(slot)
        }
        collateralSum += msg.value;

        require(collateralSum <= 7 ether, "Adding more collateral than 7 AVAX in total is not allowed");

        assembly {
            sstore(slot, collateralSum)
        }

        super.fund();
    }


   /**
    * Withdraws an amount from the loan
    * This method could be used to cash out profits from investments
    * The loan needs to remain solvent after the withdrawal
    * @param _amount to be withdrawn
    * @dev This function uses the redstone-evm-connector
   **/
    function withdraw(uint256 _amount) public override {
        super.withdraw(_amount);
        bytes32 slot = COLLATERAL_SUM_SLOT;
        uint256 collateralSum;

        assembly {
            collateralSum := sload(slot)
        }
        if(_amount > collateralSum) {
            collateralSum = 0;
        } else {
            collateralSum -= _amount;
        }

        assembly {
            sstore(slot, collateralSum)
        }
    }


    /**
   * This function can only be accessed by the owner and allows selling all of the assets.
   * @dev This function uses the redstone-evm-connector
   **/
    function closeLoan() public override payable {
        super.closeLoan();

        bytes32 slot = COLLATERAL_SUM_SLOT;
        assembly {
            sstore(slot, 0)
        }
    }
}
