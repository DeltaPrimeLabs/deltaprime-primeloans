// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "./interfaces/IAssetsExchange.sol";
//TODO: interface
import "./ERC20Pool.sol";
import "./interfaces/IYieldYakRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
//TODO: interface
import "./mock/WAVAX.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title SmartLoanProperties
 * A contract that holds SmartLoanDiamond related properties.
 * Every property has a virtual getter to allow overriding when upgrading a SmartLoanDiamond contract.
 *
 */
contract SmartLoanProperties {

  uint256 private constant _PERCENTAGE_PRECISION = 1000;
  // 10%
  uint256 private constant _MAX_LIQUIDATION_BONUS = 50;

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

  function getMaxLiquidationBonus() public virtual view returns (uint256) {
    return _MAX_LIQUIDATION_BONUS;
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
    return IYieldYakRouter(0x70952A912Fa50E04c608eb49E48afC975Eb91F21);
  }

  function getYakAvaxStakingContract() public virtual view returns (IERC20) {
    return IERC20(0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95);
  }

  function getPoolsAssetsIndices() public virtual view returns (uint8[1] memory) {
    return [0];
  }

  function getPoolTokens() public virtual view returns (IERC20Metadata[1] memory) {
    return [
      IERC20Metadata(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7)
    ];
  }

  function getPools() public virtual view returns (ERC20Pool[1] memory) {
    return [
      ERC20Pool(0xD84379CEae14AA33C123Af12424A37803F885889)
    ];
  }

  //TODO: remember that it will be updated with a deployment script...
  function getPoolAddress(bytes32 poolToken) public virtual view returns (address) {
    if (poolToken == bytes32("AVAX")) return 0xD84379CEae14AA33C123Af12424A37803F885889;

    return address(0);
  }

  function getNativeTokenWrapped() public virtual view returns (WAVAX) {
    return WAVAX(payable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7));
  }

  function getPriceProvider1() public virtual view returns (address) {
    return _PRICE_PROVIDER_1;
  }

  function getPriceProvider2() public virtual view returns (address) {
    return _PRICE_PROVIDER_2;
  }
}