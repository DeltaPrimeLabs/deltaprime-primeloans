// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

interface IVectorFinanceStaking {
    function balance(address account) external view returns (uint256);

    function withdraw(uint256 amount, uint256 minAmount) external;

    function deposit(uint256 amount) external;

    function decimals() external view returns (uint256);
}