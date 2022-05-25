pragma solidity ^0.8.4;

import "../interfaces/IAssetsExchange.sol";
import "../Pool.sol";
import "../interfaces/IYieldYakRouter.sol";
import {LibDiamond} from "../lib/LibDiamond.sol";
import "../mock/WAVAX.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SmartLoanLib {

    uint256 private constant _PERCENTAGE_PRECISION = 1000;
    // 10%
    uint256 private constant _LIQUIDATION_BONUS = 100;
    // 500%
    uint256 private constant _MAX_LTV = 5000;
    // 400%
    uint256 private constant _MIN_SELLOUT_LTV = 4000;

    address private constant _POOL_ADDRESS = 0x5ff1DE6091871adAAe64E2Ec4feD754628482868;

    address private constant _EXCHANGE_ADDRESS = 0xD49a0e9A4CD5979aE36840f542D2d7f02C4817Be;

    // redstone-evm-connector price providers
    address private constant _PRICE_PROVIDER_1 = 0x981bdA8276ae93F567922497153de7A5683708d3;

    address private constant _PRICE_PROVIDER_2 = 0x3BEFDd935b50F172e696A5187DBaCfEf0D208e48;

    address private constant _WAVAX_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _YIELD_YAK_ROUTER_ADDRESS = 0x7969c5eD335650692Bc04293B07F5BF2e7A673C0;

    address private constant _YAK_STAKING_CONTRACT = 0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95;

    // redstone-evm-connector max block.timestamp acceptable delay
    uint256 internal constant MAX_BLOCK_TIMESTAMP_DELAY = 30; // 30 seconds


    function getPercentagePrecision() internal view returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    function getLiquidationBonus() internal view returns (uint256) {
        return _LIQUIDATION_BONUS;
    }

    function getMaxLtv() internal view returns (uint256) {
        return _MAX_LTV;
    }

    function getMinSelloutLtv() internal view returns (uint256) {
        return _MIN_SELLOUT_LTV;
    }

    function getExchange() internal view returns (IAssetsExchange) {
        return IAssetsExchange(_EXCHANGE_ADDRESS);
    }

    function getNativeTokenWrapped() internal view returns (WAVAX) {
        return WAVAX(payable(_WAVAX_ADDRESS));
    }

    function getYieldYakRouter() internal view returns (IYieldYakRouter) {
        return IYieldYakRouter(_YIELD_YAK_ROUTER_ADDRESS);
    }

    function getMaxBlockTimestampDelay() internal view returns (uint256) {
        return MAX_BLOCK_TIMESTAMP_DELAY;
    }

    function getYakAvaxStakingContract() internal view returns (IERC20) {
        return IERC20(_YAK_STAKING_CONTRACT);
    }

    function getPriceProvider1() internal view returns (address) {
        return _PRICE_PROVIDER_1;
    }

    function getPriceProvider2() internal view returns (address) {
        return _PRICE_PROVIDER_2;
    }

    function getLiquidationInProgress() internal view returns (bool) {
        LibDiamond.LiquidationStorage storage ls = LibDiamond.liquidationStorage();
        return ls._liquidationInProgress;
    }

    //TODO: remember about proper sequence of pools
    //returns indices of assets that have an ERC20 pool
    function getPoolsAssetsIndices() internal view returns (uint8[1] memory) {
      return [0];
    }

    //TODO: remember that it will be updated with a deployment script...
    function getPoolAddress(bytes32 poolToken) internal view returns (address) {
        if (poolToken == bytes32("AVAX")) return 0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3;

        return address(0);
    }


}