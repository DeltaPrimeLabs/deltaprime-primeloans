// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 2f6b0fb53889a8741a3d7f78a2d5d05ad7a0c76d;
pragma solidity 0.8.17;

import "./WavaxVariableUtilisationRatesCalculator.sol";
/**
 * @title EthVariableUtilisationRatesCalculator
 * @dev Contract which calculates the interest rates based on pool utilisation.
 * Utilisation is computed as the ratio between funds borrowed and funds deposited to the pool.
 * Borrowing rates are calculated using a piecewise linear function. The first piece is defined by SLOPE_1
 * and OFFSET (shift). Second piece is defined by SLOPE_2 (calculated off-chain), BREAKPOINT (threshold value above
 * which second piece is considered) and MAX_RATE (value at pool utilisation of 1).
 **/
contract EthVariableUtilisationRatesCalculator is WavaxVariableUtilisationRatesCalculator {
}