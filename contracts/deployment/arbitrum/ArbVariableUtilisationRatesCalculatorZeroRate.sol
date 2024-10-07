// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: dd55c504f56a3b35ef5ee926b79820670a9f8344;
pragma solidity 0.8.17;

import "./WethVariableUtilisationRatesCalculatorZeroRate.sol";
/**
 * @title ArbVariableUtilisationRatesCalculatorZeroRate
 * @dev Contract which returns a constant value of 0 for the deposit and borrowing rates.
 **/
contract ArbVariableUtilisationRatesCalculatorZeroRate is WethVariableUtilisationRatesCalculatorZeroRate{
}