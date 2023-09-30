// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/gmx-v2/IOrderCallbackReceiver.sol";
import "../interfaces/gmx-v2/Order.sol";

contract TestGmxV2 is IOrderCallbackReceiver {

    address GMX_V2_EXCHANGE_ROUTER_TOKEN = 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8;
    address GMX_V2_DEPOSIT_VAULT = 0x2069309427e27b018222f9D298371358959EFFB3;
    address GM_ETH_USDC = 0x70d95587d40a2caf56bd97485ab3eec10bee6336;
    address ETH = 0x82af49447d8a07e3bd95bd0d56f35241523fbab1;
    address USDC = 0xaf88d065e77c8cc2239327c5edb3a432268e5831;

    function getSelector(string calldata _func) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes_func));
    }

    function depositEthUsdc(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) public returns (bool) {
        address depositedToken = isLongToken ? ETH : USDC;

        IERC20(depositedToken).approve(GMX_V2_DEPOSIT_VAULT, tokenAmount);

        bytes memory callData = abi.encodePacked(
            abi.encodeWithSelector(
                getSelector("sendTokens"),
                depositedToken,
                GMX_V2_DEPOSIT_VAULT,
                tokenAmount
            ),
            abi.encodeWithSelector(
                getSelector("createDeposit"),
                address(this), //receiver
                address(this), //callbackContract
                GM_ETH_USDC, //market
                ETH, //initialLongToken
                USDC, //initialShortToken
                new address[](0), //longTokenSwapPath
                new address[](0), //shortTokenSwapPath
                minGmAmount, //minMarketTokens
                false, //shouldUnwrapNativeToken
                executionFee, //executionFee
                0, //callbackGasLimit
                address(0) //uiFeeReceiver
            )
        );

        (bool success, bytes memory returnData) = target.call(callData);

        //TODO: pause the Prime Account
        return success;
    }

    function afterOrderExecution(bytes32 key, Order.Props memory order, EventUtils.EventLogData memory eventData) external returns(bool) {
        return true;
    }

    function afterOrderCancellation(bytes32 key, Order.Props memory order, EventUtils.EventLogData memory eventData) external returns(bool){
        return true;
    }

    function afterOrderFrozen(bytes32 key, Order.Props memory order, EventUtils.EventLogData memory eventData) external returns(bool) {
        return true;
    }
}



