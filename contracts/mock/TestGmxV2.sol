// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/gmx-v2/IOrderCallbackReceiver.sol";
import "../interfaces/gmx-v2/Order.sol";
import "../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract TestGmxV2 is IOrderCallbackReceiver {

    address GMX_V2_ROUTER = 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    address GMX_V2_EXCHANGE_ROUTER = 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8;
    address GMX_V2_DEPOSIT_VAULT = 0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55;
    address GM_ETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address ETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    function getSelector(string memory _func) internal pure returns (bytes4) {
        return bytes4(keccak256(bytes(_func)));
    }

    function depositEthUsdc(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) public payable returns (bytes[] memory) {
        address depositedToken = isLongToken ? ETH : USDC;

        IERC20(depositedToken).approve(GMX_V2_ROUTER, tokenAmount);

        bytes[] memory data = new bytes[](3);

        data[0] = abi.encodeWithSelector(
            Router.sendWnt.selector,
            GMX_V2_DEPOSIT_VAULT,
            executionFee
        );
        data[1] = abi.encodeWithSelector(
            Router.sendTokens.selector,
            depositedToken,
            GMX_V2_DEPOSIT_VAULT,
            tokenAmount
        );
        data[2] = abi.encodeWithSelector(
            Deposit.createDeposit.selector,
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

        bytes[] memory results = BasicMulticall(GMX_V2_EXCHANGE_ROUTER).multicall{ value: msg.value }(data);

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

interface Deposit {
    struct CreateDepositParams {
        address receiver;
        address callbackContract;
        address uiFeeReceiver;
        address market;
        address initialLongToken;
        address initialShortToken;
        address[] longTokenSwapPath;
        address[] shortTokenSwapPath;
        uint256 minMarketTokens;
        bool shouldUnwrapNativeToken;
        uint256 executionFee;
        uint256 callbackGasLimit;
    }

    function createDeposit(CreateDepositParams calldata params) external payable returns (bytes32);

}

interface Router {
    function sendWnt(address receiver, uint256 amount) external payable;

    function sendTokens(address token, address receiver, uint256 amount) external payable;
}



