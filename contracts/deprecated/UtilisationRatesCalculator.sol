// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRatesCalculator.sol";
import "../lib/WadRayMath.sol";


/**
 * @title UtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Rates are calculated using a linear function with slope defined by _utilisation factor and
 * shifted by an offset parameter.
 */
contract UtilisationRatesCalculator is IRatesCalculator, Ownable {
    using WadRayMath for uint256;

    uint256 utilisationFactor;
    uint256 offset;

    constructor(uint256 _utilisationFactor, uint256 _offset) {
        setParameters(_utilisationFactor, _offset);
    }


    /* ========== SETTERS ========== */


    /**
     * Sets the utilisation parameters that control rates calculation according to the linear formula:
     * Rate = utilisation * utilisationFactor + offset
     * @dev _utilisationFactor the slope of the rate formula
     * @dev _offset the offset of the rate formula
    **/
    function setParameters(uint256 _utilisationFactor, uint256 _offset) public onlyOwner {
        require(_utilisationFactor <= 1 ether, "Calculator factor must not be higher than 1.");
        require(_offset <= 1 ether, "Calculator offset must not be higher than 1.");

        utilisationFactor = _utilisationFactor;
        offset = _offset;

        emit ParametersUpdated(_utilisationFactor, _offset);
    }


    /* ========== VIEW FUNCTIONS ========== */


    /**
      * Returns the pool utilisation, which is a ratio between loans and deposits
      * utilisation = value_of_loans / value_of_deposits
      * @dev _totalLoans total value of loans
      * @dev _totalDeposits total value of deposits
    **/
    function getPoolUtilisation(uint256 _totalLoans, uint256 _totalDeposits) public pure returns(uint256) {
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
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns(uint256) {
        if (_totalDeposits == 0) return 0;

      if (_totalLoans >= _totalDeposits) {
          return this.calculateBorrowingRate(_totalLoans, _totalDeposits);
        } else {
          return this.calculateBorrowingRate(_totalLoans, _totalDeposits).wadToRay()
          .rayMul(_totalLoans.wadToRay())
          .rayDiv(_totalDeposits.wadToRay())
          .rayToWad();
      }
    }

      /**
      * Returns the current borrowing rate
      * The value is based on the pool utilisation according to the linear formula:
      * borrowing_rate = utilisation * utilisationFactor + offset
      * @dev _totalLoans total value of loans
      * @dev _totalDeposits total value of deposits
    **/
    function calculateBorrowingRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns(uint256) {
      if (_totalLoans >= _totalDeposits) {
        return utilisationFactor + offset;
      } else {
        return getPoolUtilisation(_totalLoans, _totalDeposits).wadToRay()
                  .rayMul(utilisationFactor.wadToRay()).rayToWad()
                  + offset;
      }
    }


    /* ========== EVENTS ========== */


    /**
      * An event notifying about the parameters update.
      * @dev utilisationFactor the value of updated rate
      * @dev offset the value of updated rate
    **/
    event ParametersUpdated(uint256 utilisationFactor, uint256 offset);

}
