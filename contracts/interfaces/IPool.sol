// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPool is IERC20 {
    function getLockedBalance(address account) external view returns (uint256);
    function lockDeposit(uint256 amount, uint256 lockTime) external;
    function getFullyVestedLockedBalanceToNonVestedRatio(address account) external view returns (uint256);
    function setVPrimeController(address _vPrimeController) external;
    function deposit(uint256 _amount) external;
    function depositOnBehalf(uint256 _amount, address _of) external;
    function withdraw(uint256 _amount) external;
    function borrow(uint256 _amount) external;
    function repay(uint256 amount) external;
    function getBorrowed(address _user) external view returns (uint256);
    function balanceOf(address user) external view override returns (uint256);
    function getDepositRate() external view returns (uint256);
    function getBorrowingRate() external view returns (uint256);
    function getFullPoolStatus() external view returns (uint256[5] memory);
    function recoverSurplus(uint256 amount, address account) external;
    function isWithdrawalAmountAvailable(address account, uint256 amount) external view returns (bool);
    function getMaxPoolUtilisationForBorrowing() external view returns (uint256);
    function totalBorrowed() external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
    function name() external view returns (string memory);
    function totalSupplyCap() external view returns (uint256);
    function ratesCalculator() external view returns (address);
    function borrowersRegistry() external view returns (address);
    function poolRewarder() external view returns (address);
    function depositIndex() external view returns (address);
    function borrowIndex() external view returns (address);
    function tokenAddress() external view returns (address);
    function vestingDistributor() external view returns (address);
    function vPrimeControllerContract() external view returns (address);
}