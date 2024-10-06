// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8c36e18a206b9e6649c00da51c54b92171ce3413;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRatesCalculator.sol";

/**
 * @title MockVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
 **/
contract MockVariableUtilisationRatesCalculatorZeroRate is IRatesCalculator, Ownable {
    uint256 public constant SLOPE_1 = 0;
    uint256 public constant OFFSET_1 = 0.03e18;

    uint256 public constant BREAKPOINT_1 = 0.6e18;

    uint256 public constant SLOPE_2 = 0.45e18;
    //negative, hence minus in calculations
    uint256 public constant OFFSET_2 = 0.24e18;

    uint256 public constant BREAKPOINT_2 = 0.8e18;

    uint256 public constant SLOPE_3 = 3.15e18;
    //negative, hence minus in calculations
    uint256 public constant OFFSET_3 = 2.4e18;

    // BREAKPOINT must be lower than 1e18
    uint256 public constant MAX_RATE = 0.75e18;

    //20% of spread goes to vesting participants
    uint256 public spread = 2e17;

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
     * Always returns 0
     **/
    function calculateDepositRate(uint256 _totalLoans, uint256 _totalDeposits) external view override returns (uint256) {
        return 0;
    }

    /**
     * Always returns 0
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external pure override returns (uint256) {
        return 0;
    }

    /* ========== SETTERS ========== */
    /**
     * Sets the spread between deposit and borrow rate, number between 0 and 1e18
     * @param _spread spread defined by user
     **/
    function setSpread(uint256 _spread) external onlyOwner {
        require(_spread < 1e18, "Spread must be smaller than 1e18");
        spread = _spread;
        emit SpreadChanged(msg.sender, _spread, block.timestamp);
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    function renounceOwnership() public virtual override {}

    /* ========== EVENTS ========== */

    /**
     * @dev emitted after changing the spread
     * @param performer an address of wallet setting a new spread
     * @param newSpread new spread
     * @param timestamp time of a spread change
     **/
    event SpreadChanged(address indexed performer, uint256 newSpread, uint256 timestamp);
}