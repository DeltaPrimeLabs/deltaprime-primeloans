// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: dd55c504f56a3b35ef5ee926b79820670a9f8344;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";

/**
 * @title WethVariableUtilisationRatesCalculatorZeroRate
 * @dev Contract which returns a constant value of 0 for the deposit and borrowing rates.
 **/
contract WethVariableUtilisationRatesCalculatorZeroRate is WethVariableUtilisationRatesCalculator {
    /**
     * Always return 0 as deposit rate
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0;
    }

    /**
     * Always return 0 as deposit rate
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0;
    }
}