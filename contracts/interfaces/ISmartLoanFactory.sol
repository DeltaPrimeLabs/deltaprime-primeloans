// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

/// @title ISmartLoanFactory
interface ISmartLoanFactory {
    function canBorrow(address _account) external view returns (bool);
}
