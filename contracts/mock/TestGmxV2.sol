// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/gmx-v2/IOrderCallbackReceiver.sol";
import "../interfaces/gmx-v2/Order.sol";
import "../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract TestGmxV2 is IOrderCallbackReceiver {

    address GMX_V2_ROUTER = 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    address GMX_V2_DEPOSIT_VAULT = 0x2069309427e27b018222f9D298371358959EFFB3;
    address GM_ETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address ETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    function getSelector(string memory _func) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes(_func)));
    }

    function depositEthUsdc(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) public returns (bytes[] memory) {
        address depositedToken = isLongToken ? ETH : USDC;

        IERC20(depositedToken).approve(GMX_V2_ROUTER, tokenAmount);

        bytes[] memory data = new bytes[](2);

        data[0] = abi.encodeWithSelector(
                getSelector("sendTokens"),
                depositedToken,
                GMX_V2_DEPOSIT_VAULT,
                tokenAmount
            );
        data[1] = abi.encodeWithSelector(
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
            );

        bytes[] memory results = BasicMulticall(GMX_V2_ROUTER).multicall(data);

        //TODO: pause the Prime Account
        return results;
    }

    function afterOrderExecution(bytes32 key, Order.Props memory order, EventUtils.EventLogData memory eventData) external {
    }

    function afterOrderCancellation(bytes32 key, Order.Props memory order, EventUtils.EventLogData memory eventData) external {
    }

    function afterOrderFrozen(bytes32 key, Order.Props memory order, EventUtils.EventLogData memory eventData) external {
    }
}


