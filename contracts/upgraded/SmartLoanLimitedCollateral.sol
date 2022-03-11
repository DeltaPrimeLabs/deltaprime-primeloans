// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 0fbd3d2132ce3d3a12c966ee5e6ffba53aae9d33;
pragma solidity ^0.8.4;
import "../SmartLoan.sol";
import "hardhat/console.sol";

contract SmartLoanLimitedCollateral is SmartLoan {
    using TransferHelper for address payable;

    bytes32 internal constant COLLATERAL_SUM_SLOT = bytes32(uint256(keccak256('COLLATERAL_SUM')) - 1);

   /**
    * Funds a loan with the value attached to the transaction
    * Allows to add up to 1.25 AVAX of collateral in total
   **/
    function fund() public override payable {
        console.log('INF UUND');
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
    function withdraw(uint256 _amount) public override onlyOwner nonReentrant remainsSolvent {
        console.log('INF WITH');
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
    function closeLoan() external override payable onlyOwner nonReentrant remainsSolvent {
        console.log('INF CLOSSE');
        bytes32 slot = COLLATERAL_SUM_SLOT;
        uint256 collateralSum;

        bytes32[] memory assets = getExchange().getAllAssets();
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 balance = getERC20TokenInstance(assets[i]).balanceOf(address(this));
            if (balance > 0) {
                sellAsset(assets[i], balance, 0);
            }
        }

        uint256 debt = getDebt();
        require(address(this).balance >= debt, "Selling out all assets without repaying the whole debt is not allowed");
        repay(debt);
        emit LoanClosed(debt, address(this).balance, block.timestamp);

        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(msg.sender).safeTransferETH(balance);
            emit Withdrawn(msg.sender, balance, block.timestamp);
        }
        assembly {
            sstore(slot, 0)
        }
    }
}
