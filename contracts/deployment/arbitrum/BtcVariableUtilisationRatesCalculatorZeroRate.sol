// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 7ebffa3a6a7de6896f193b941186372a7bd3f209;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculatorZeroRate.sol";
/**
 * @title BtcVariableUtilisationRatesCalculator
 * @dev Contract which returns a constant value of 0 for the deposit and borrowing rates.
 **/
contract BtcVariableUtilisationRatesCalculatorZeroRate is WethVariableUtilisationRatesCalculatorZeroRate {
}