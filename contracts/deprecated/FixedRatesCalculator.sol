// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../IRatesCalculator.sol";


/**
 * @title FixedRatesCalculator
 * @dev It allows to set fixed deposit and borrowing rates that could be manually updated.
 */
contract FixedRatesCalculator is IRatesCalculator, Ownable {

    uint256 depositRate;
    uint256 borrowingRate;

    constructor(uint256 _depositRate, uint256 _borrowingRate) {
        setRates(_depositRate, _borrowingRate);
    }


    /* ========== SETTERS ========== */


    /**
     * Sets the new deposit and borrowing rate
     * Before the new rate is set, the index is updated accumulating interest
     * @dev _depositRate the value of updated deposit rate
     * @dev _borrowingRate the value of updated borrowing rate
    **/
    function setRates(uint256 _depositRate, uint256 _borrowingRate) public onlyOwner {
        if(_depositRate > _borrowingRate) revert BorrowingRateLTDepositRate();

        depositRate = _depositRate;
        borrowingRate = _borrowingRate;

        emit RatesUpdated(depositRate, borrowingRate);
    }


    /* ========== VIEW FUNCTIONS ========== */


    /**
      * Returns the current deposit rate
      * The parameters are kept only because of the interface compatibility as they don't affect the rate
    **/
    function calculateDepositRate(uint256 totalLoans, uint256 totalDeposits) external view override returns(uint256) {
        return depositRate;
    }

    /**
      * Returns the current borrowing rate
      * The parameters are kept only because of the interface compatibility as they don't affect the rate
    **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external view override returns(uint256) {
        return borrowingRate;
    }


    /* ========== EVENTS ========== */


    /**
      * An event notifying about the rates update.
      * @dev updatedDepositRate the value of updated rate
      * @dev updatedBorrowingRate the value of updated rate
    **/
    event RatesUpdated(uint256 updatedDepositRate, uint256 updatedBorrowingRate);

}


/// Borrowing rate cannot be lower than the deposit rate
error BorrowingRateLTDepositRate();
