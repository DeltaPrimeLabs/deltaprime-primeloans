// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: af83a623e5b45c473439613a742691527a4af323;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculator.sol";

/**
 * @title WethVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
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