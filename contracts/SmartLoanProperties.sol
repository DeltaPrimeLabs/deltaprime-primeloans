// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "redstone-evm-connector/lib/contracts/message-based/PriceAwareUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IAssetsExchange.sol";
import "./Pool.sol";

/**
 * @title SmartLoanProperties
 * A contract that holds SmartLoan related properties.
 * Every property has a virtual getter to allow overriding when upgrading a SmartLoan contract.
 *
 */
contract SmartLoanProperties {

  uint256 private constant _PERCENTAGE_PRECISION = 1000;
  // 10%
  uint256 private constant _LIQUIDATION_BONUS = 100;

  // 500%
  uint256 private constant _MAX_LTV = 5000;
  // 400%
  uint256 private constant _MIN_SELLOUT_LTV = 4000;

  address private constant _EXCHANGE_ADDRESS = 0x4826533B4897376654Bb4d4AD88B7faFD0C98528;

  address private constant _POOL_ADDRESS = 0x95401dc811bb5740090279Ba06cfA8fcF6113778;


  /* ========== GETTERS ========== */


  function getPercentagePrecision() public virtual view returns (uint256) {
    return _PERCENTAGE_PRECISION;
  }

  function getLiquidationBonus() public virtual view returns (uint256) {
    return _LIQUIDATION_BONUS;
  }

  function getMaxLtv() public virtual view returns (uint256) {
    return _MAX_LTV;
  }

  function getMinSelloutLtv() public virtual view returns (uint256) {
    return _MIN_SELLOUT_LTV;
  }

  function getExchange() public virtual view returns (IAssetsExchange) {
    return IAssetsExchange(_EXCHANGE_ADDRESS);
  }

  function getPool() public virtual view returns (Pool) {
    return Pool(_POOL_ADDRESS);
  }
}