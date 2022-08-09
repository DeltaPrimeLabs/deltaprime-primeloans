pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IAssetsExchange.sol";
import "../Pool.sol";
import "../PoolManager.sol";
import "../interfaces/IYieldYakRouter.sol";
import {LibDiamond} from "../lib/LibDiamond.sol";
import "../mock/WAVAX.sol";
import "../ERC20Pool.sol";
import "../RedstoneConfigManager.sol";

library SmartLoanLib {

    uint256 private constant _PERCENTAGE_PRECISION = 1000;
    // 5%
    uint256 private constant _MAX_LIQUIDATION_BONUS = 50;
    // 500%
    uint256 private constant _MAX_LTV = 5000;
    // 400%
    uint256 private constant _MIN_SELLOUT_LTV = 4000;

    address private constant _POOL_ADDRESS = 0x5ff1DE6091871adAAe64E2Ec4feD754628482868;

    // TODO: Remove after using RestoneConfigManager on production
    // redstone-evm-connector price providers
    address private constant _PRICE_PROVIDER_1 = 0x981bdA8276ae93F567922497153de7A5683708d3;

    address private constant _PRICE_PROVIDER_2 = 0x3BEFDd935b50F172e696A5187DBaCfEf0D208e48;

    address private constant _WAVAX_ADDRESS = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;

    address private constant _YIELD_YAK_ROUTER_ADDRESS = 0x2B0d36FACD61B71CC05ab8F3D2355ec3631C0dd5;

    address private constant _YAK_STAKING_CONTRACT = 0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95;

    address private constant _PANGOLIN_ROUTER_CONTRACT = 0x0000000000000000000000000000000000000000;

    address private constant _DIAMOND_BEACON_ADDRESS = 0x2Dd78Fd9B8F40659Af32eF98555B8b31bC97A351;

    // redstone-evm-connector max block.timestamp acceptable delay
    uint256 internal constant MAX_BLOCK_TIMESTAMP_DELAY = 30; // 30 seconds

    function getDiamondAddress() internal view returns (address) {
        return _DIAMOND_BEACON_ADDRESS;
    }

    function getPercentagePrecision() internal view returns (uint256) {
        return _PERCENTAGE_PRECISION;
    }

    function getMaxLiquidationBonus() internal view returns (uint256) {
        return _MAX_LIQUIDATION_BONUS;
    }

    function getMaxLtv() internal view returns (uint256) {
        return _MAX_LTV;
    }

    function getMinSelloutLtv() internal view returns (uint256) {
        return _MIN_SELLOUT_LTV;
    }

    function getPoolManager() internal view returns (PoolManager) {
    return PoolManager(0xccf1769D8713099172642EB55DDFFC0c5A444FE9);
    }

    function getNativeTokenSymbol() internal pure returns (bytes32[] memory symbol) {
        symbol = new bytes32[](1);
        symbol[0] = "AVAX";
    }

    function getRedstoneConfigManager() internal view returns (RedstoneConfigManager) {
    return RedstoneConfigManager(0x8F4ec854Dd12F1fe79500a1f53D0cbB30f9b6134);
    }

    function getNativeTokenWrapped() internal view returns (WAVAX) {
        return WAVAX(payable(_WAVAX_ADDRESS));
    }

    function getYieldYakRouter() internal view returns (IYieldYakRouter) {
    return IYieldYakRouter(0x0000000000000000000000000000000000000000);
    }

    function getMaxBlockTimestampDelay() internal view returns (uint256) {
        return MAX_BLOCK_TIMESTAMP_DELAY;
    }

    function getYakAvaxStakingContract() internal view returns (IERC20) {
        return IERC20(_YAK_STAKING_CONTRACT);
    }

    function getPangolinRouterContract() internal view returns (address) {
        return _PANGOLIN_ROUTER_CONTRACT;
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

    function setLiquidationInProgress(bool _status) internal {
        LibDiamond.LiquidationStorage storage ls = LibDiamond.liquidationStorage();
        ls._liquidationInProgress = _status;
    }

    /**
    * Returns all owned assets keys
    **/
    function getAllOwnedAssets() internal view returns (bytes32[] memory result) {
        LibDiamond.SmartLoanStorage storage sls = LibDiamond.smartLoanStorage();
        return sls.ownedAssets._inner._keys._inner._values;
    }
}