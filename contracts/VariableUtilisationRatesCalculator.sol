// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRatesCalculator.sol";
import "./lib/WadRayMath.sol";


/**
 * @title VariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
**/
contract VariableUtilisationRatesCalculator is IRatesCalculator, Ownable {
  using WadRayMath for uint256;

  uint256 public constant SLOPE_1 = 0.12 ether;
  uint256 public constant OFFSET = 0.05 ether;
  // BREAKPOINT must be lower than 1 ether
  uint256 public constant BREAKPOINT = 0.8 ether;
  uint256 public constant MAX_RATE = 0.75 ether;

  // calculated off-chain for gas efficiency with following formula:
  // (MAX_RATE - OFFSET - SLOPE_1 * BREAKPOINT) / (1 - BREAKPOINT)
  uint256 public constant SLOPE_2 = 3.02 ether;


/* ========== VIEW FUNCTIONS ========== */


  /**
    * Returns the pool utilisation, which is a ratio between loans and deposits
    * utilisation = value_of_loans / value_of_deposits
    * @dev _totalLoans total value of loans
    * @dev _totalDeposits total value of deposits
  **/
  function getPoolUtilisation(uint256 _totalLoans, uint256 _totalDeposits) public pure returns (uint256) {
    if (_totalDeposits == 0) return 0;

    return _totalLoans.wadToRay()
    .rayDiv(_totalDeposits.wadToRay())
    .rayToWad();
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
      return this.calculateBorrowingRate(_totalLoans, _totalDeposits).wadToRay()
      .rayMul(_totalLoans.wadToRay())
      .rayDiv(_totalDeposits.wadToRay())
      .rayToWad();
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

    if (poolUtilisation >= 1 ether) {
      return MAX_RATE;
    } else if (poolUtilisation <= BREAKPOINT) {
      return poolUtilisation.wadToRay()
        .rayMul(SLOPE_1.wadToRay()).rayToWad()
        + OFFSET;
    } else {
      // full formula derived from piecewise linear function calculation except for SLOPE_2 subtraction (separated for
      // unsigned integer safety check)
      uint256 value = SLOPE_2.wadToRay()
        .rayMul(poolUtilisation.wadToRay()).rayToWad()
        + MAX_RATE;

      if(value < SLOPE_2) revert SlopeCalculationOutOfRange();

      return value - SLOPE_2;
    }
  }
}


/// Out of range value when calculating borrowing rate. Consider checking if SLOPE_2 is calculated correctly
error SlopeCalculationOutOfRange();
