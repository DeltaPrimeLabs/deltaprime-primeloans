// SPDX-License-Identifier: UNLICENSED
// Last deployed using commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRatesCalculator.sol";

/**
 * @title VariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
 **/
contract VariableUtilisationRatesCalculator is IRatesCalculator, Ownable {
  uint256 public constant SLOPE_1 = 0.12e18;
  uint256 public constant OFFSET = 0.05e18;
  // BREAKPOINT must be lower than 1e18
  uint256 public constant BREAKPOINT = 0.8e18;
  uint256 public constant MAX_RATE = 0.75e18;

  // calculated off-chain for gas efficiency with following formula:
  // (MAX_RATE - OFFSET - SLOPE_1 * BREAKPOINT) / (1 - BREAKPOINT)
  uint256 public constant SLOPE_2 = 3.02e18;

  /* ========== VIEW FUNCTIONS ========== */

  /**
   * Returns the pool utilisation, which is a ratio between loans and deposits
   * utilisation = value_of_loans / value_of_deposits
   * @dev _totalLoans total value of loans
   * @dev _totalDeposits total value of deposits
   **/
  function getPoolUtilisation(uint256 _totalLoans, uint256 _totalDeposits) public pure returns (uint256) {
    if (_totalDeposits == 0) return 0;

    return (_totalLoans * 1e18) / _totalDeposits;
  }

  /**
   * Returns the current deposit rate
   * The value is based on the current borrowing rate and satisfies the invariant:
   * value_of_loans * borrowing_rate = value_of_deposits * deposit_rate
   * @dev _totalLoans total value of loans
   * @dev _totalDeposits total value of deposits
   **/
  function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
    if (_totalDeposits == 0) return 0;

    if (_totalLoans >= _totalDeposits) {
      return MAX_RATE;
    } else {
      return (this.calculateBorrowingRate(_totalLoans, _totalDeposits) * _totalLoans) / _totalDeposits;
    }
  }

  /**
   * Returns the current borrowing rate
   * The value is based on the pool utilisation according to the piecewise linear formula:
   * 1) for pool utilisation lower than or equal to breakpoint:
   * borrowing_rate = SLOPE_1 * utilisation + OFFSET
   * 2) for pool utilisation greater than breakpoint:
   * borrowing_rate = SLOPE_2 * utilisation + MAX_RATE - SLOPE_2
   * @dev _totalLoans total value of loans
   * @dev _totalDeposits total value of deposits
   **/
  function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external view override returns (uint256) {
    if (totalDeposits == 0) return OFFSET;

    uint256 poolUtilisation = getPoolUtilisation(totalLoans, totalDeposits);

    if (poolUtilisation >= 1e18) {
      return MAX_RATE;
    } else if (poolUtilisation <= BREAKPOINT) {
      return (poolUtilisation * SLOPE_1) / 1e18 + OFFSET;
    } else {
      // full formula derived from piecewise linear function calculation except for SLOPE_2 subtraction (separated for
      // unsigned integer safety check)
      uint256 value = (poolUtilisation * SLOPE_2) / 1e18 + MAX_RATE;

      require(value >= SLOPE_2, "Out of range value when calculating the borrowing rate. Consider checking if SLOPE_2 is calculated correctly");

      return value - SLOPE_2;
    }
  }
}