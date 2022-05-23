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

    // redstone-evm-connector max block.timestamp acceptable delay
    uint256 internal constant MAX_BLOCK_TIMESTAMP_DELAY = 30; // 30 seconds


    function getPercentagePrecision() internal view returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    function getLiquidationBonus() internal view returns (uint256) {
        return _LIQUIDATION_BONUS;
    }

    function getLiquidationInProgress() internal view returns (bool) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds._liquidationInProgress;
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
        return WAVAX(payable(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7));
    }

    function getYieldYakRouter() internal view returns (IYieldYakRouter) {
        // TODO: Make it upgradeable or explicitly move to a constant?
        return IYieldYakRouter(0xa6e99A4ED7498b3cdDCBB61a6A607a4925Faa1B7);
    }

    function getMaxBlockTimestampDelay() internal view returns (uint256) {
        return MAX_BLOCK_TIMESTAMP_DELAY;
    }

    function getYakAvaxStakingContract() internal view returns (IERC20) {
        return IERC20(0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95);
    }

    function getPriceProvider1() internal view returns (address) {
        return _PRICE_PROVIDER_1;
    }

    function getPriceProvider2() internal view returns (address) {
        return _PRICE_PROVIDER_2;
    }

    //TODO: remember about proper sequence of pools
    //returns indices of assets that have an ERC20 pool
    function getPoolsAssetsIndices() internal view returns (uint8[2] memory) {
      return [0,1];
    }

    //TODO: remember that it will be updated with a deployment script...
    function getPoolAddress(bytes32 poolToken) internal view returns (address) {
    if (poolToken == bytes32("USD")) return 0x6C2d83262fF84cBaDb3e416D527403135D757892;
    if (poolToken == bytes32("AVAX")) return 0xFD6F7A6a5c21A3f503EBaE7a473639974379c351;
        return address(0);
    }


}