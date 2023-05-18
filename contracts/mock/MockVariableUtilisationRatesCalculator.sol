// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 8c36e18a206b9e6649c00da51c54b92171ce3413;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IRatesCalculator.sol";

/**
 * @title MockVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by slopes[0]
 * and OFFSET (shift). Second piece is defined by slopes[1] (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and maxRate (value at pool utilisation of 1).
 **/
contract MockVariableUtilisationRatesCalculator is IRatesCalculator, Ownable {
    uint256[4] public slopes = [
        0,
        0.45e18,
        3.15e18,
        0
    ];
    uint256[4] public offsets = [
        0.03e18,
        0.24e18,
        2.4e18,
        0
    ];
    // BREAKPOINT must be lower than 1e18
    uint256[3] public breakpoints = [
        0.6e18,
        0.8e18,
        0
    ];
    uint256 public maxRate = 0.75e18;

    //20% of spread goes to vesting participants
    uint256 public spread = 2e17;

    /* ========== VIEW FUNCTIONS ========== */

    /// @notice Gets current slopes, offsets, breakpoints and maxRate values
    function getUtilisationValues() external view returns (
            uint256[4] memory,
            uint256[4] memory,
            uint256[3] memory,
            uint256
    ) {
        return (slopes, offsets, breakpoints, maxRate);
    }

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
            return maxRate * (1e18 - spread) / 1e18;
        } else {
            uint256 rate = this.calculateBorrowingRate(_totalLoans, _totalDeposits) * (1e18 - spread) * _totalLoans / (_totalDeposits * 1e18);
            return rate;
        }
    }

    /**
     * Returns the current borrowing rate
     * The value is based on the pool utilisation according to the piecewise linear formula:
     * 1) for pool utilisation lower than or equal to breakpoint:
     * borrowing_rate = slopes[0] * utilisation + OFFSET
     * 2) for pool utilisation greater than breakpoint:
     * borrowing_rate = slopes[1] * utilisation + maxRate - slopes[1]
     * @dev _totalLoans total value of loans
     * @dev _totalDeposits total value of deposits
     **/
    function calculateBorrowingRate(uint256 totalLoans, uint256 totalDeposits) external view override returns (uint256) {
        if (totalDeposits == 0) return offsets[0];

        uint256 poolUtilisation = getPoolUtilisation(totalLoans, totalDeposits);

        if (poolUtilisation >= 1e18) {
            return maxRate;
        } else if (poolUtilisation <= breakpoints[0]) {
            return (poolUtilisation * slopes[0]) / 1e18 + offsets[0];
        } else if (poolUtilisation <= breakpoints[1]) {
            return (poolUtilisation * slopes[1]) / 1e18 - offsets[1];
        } else {
            // full formula derived from piecewise linear function calculation except for slopes[1] subtraction (separated for
            // unsigned integer safety check)
            return (poolUtilisation * slopes[2]) / 1e18 - offsets[2];
        }
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

    /// @notice Sets the slopes, offsets, breakpoints and maxRate
    /// @param _slopes New slopes value
    /// @param _offsets New offsets value
    /// @param _breakpoints New breakpoints value
    /// @param _maxRate New maxRate value
    function setUtilisationValues(
        uint256[4] memory _slopes,
        uint256[4] memory _offsets,
        uint256[3] memory _breakpoints,
        uint256 _maxRate
    ) external onlyOwner {
        for (uint256 i = 1; i < 4; ++i) {
            require(_slopes[i - 1] < _slopes[i], "slope[i - 1] >= slope[i]");
            require(_offsets[i - 1] < _offsets[i], "offsets[i - 1] >= offsets[i]");
        }
        for (uint256 i = 1; i < 3; ++i) {
            require(_breakpoints[i - 1] < _breakpoints[i], "breakpoints[i - 1] >= breakpoints[i]");
        }
        for (uint256 i; i < 3; ++i) {
            require(_breakpoints[i] < 1e18, "breakpoints[i] >= 1e18");
            breakpoints[i] = _breakpoints[i];
        }
        for (uint256 i; i < 4; ++i) {
            slopes[i] = _slopes[i];
            offsets[i] = _offsets[i];
        }
        maxRate = _maxRate;
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