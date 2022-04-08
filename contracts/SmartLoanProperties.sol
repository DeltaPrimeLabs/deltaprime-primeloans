// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "./interfaces/IAssetsExchange.sol";
import "./Pool.sol";
import "./interfaces/IYieldYakRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

  address private constant _EXCHANGE_ADDRESS = 0x0278438423f433e277F65D14c0E002b8828702ba;

  address private constant _POOL_ADDRESS = 0x5ff1DE6091871adAAe64E2Ec4feD754628482868;

  // redstone-evm-connector price providers
  address private constant _PRICE_PROVIDER_1 = 0x981bdA8276ae93F567922497153de7A5683708d3;

  address private constant _PRICE_PROVIDER_2 = 0x3BEFDd935b50F172e696A5187DBaCfEf0D208e48;

  // redstone-evm-connector max block.timestamp acceptable delay
  uint256 internal constant MAX_BLOCK_TIMESTAMP_DELAY = 30; // 30 seconds

  bool internal _liquidationInProgress = false;


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

  function getYieldYakRouter() public virtual view returns (IYieldYakRouter) {
    return IYieldYakRouter(0x4C4a2f8c81640e47606d3fd77B353E87Ba015584);
  }

  function getYakAvaxStakingContract() public virtual view returns (IERC20) {
    return IERC20(0x957Ca4a4aA7CDc866cf430bb140753F04e273bC0);
  }

  function getPool() public virtual view returns (Pool) {
    return Pool(0x431290dF15777d46174b83C9E01F87d7b70D3073);
  }

  function getPriceProvider1() public virtual view returns (address) {
    return _PRICE_PROVIDER_1;
  }

  function getPriceProvider2() public virtual view returns (address) {
    return _PRICE_PROVIDER_2;
  }
}