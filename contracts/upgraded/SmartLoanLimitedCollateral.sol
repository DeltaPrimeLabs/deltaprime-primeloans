// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
import "../SmartLoan.sol";

contract SmartLoanLimitedCollateral is SmartLoan {
    using TransferHelper for address payable;

    bytes32 internal constant COLLATERAL_SUM_SLOT = bytes32(uint256(keccak256('COLLATERAL_SUM')) - 1);

   /**
    * Funds a loan with the value attached to the transaction
    * Allows to add up to 1.25 AVAX of collateral in total
   **/
    function fund() public override payable {
        bytes32 slot = COLLATERAL_SUM_SLOT;
        uint256 collateralSum;

        assembly {
            collateralSum := sload(slot)
        }
        collateralSum += msg.value;

        require(collateralSum <= 1.25 ether, "Adding more than 1.25 AVAX is not allowed");

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
}
