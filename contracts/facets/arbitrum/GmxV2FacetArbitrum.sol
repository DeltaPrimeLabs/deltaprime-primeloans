// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../../interfaces/facets/avalanche/IGLPRewarder.sol";
import "../../interfaces/facets/avalanche/IRewardRouterV2.sol";
import "../../interfaces/facets/avalanche/IRewardTracker.sol";
import "../../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";

import "../../interfaces/gmx-v2/Deposit.sol";
import "../../interfaces/gmx-v2/Withdrawal.sol";
import "../../interfaces/gmx-v2/Order.sol";
import "../../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../interfaces/gmx-v2/IDepositCallbackReceiver.sol";
import "../../interfaces/gmx-v2/EventUtils.sol";
import "../../interfaces/gmx-v2/IDepositUtils.sol";
import "../../interfaces/gmx-v2/IWithdrawalUtils.sol";
import "../../interfaces/gmx-v2/IGmxV2Router.sol";
import "../../interfaces/gmx-v2/IWithdrawalCallbackReceiver.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract GmxV2FacetArbitrum is  IDepositCallbackReceiver, IWithdrawalCallbackReceiver, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    address GMX_V2_ROUTER = 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    address GMX_V2_EXCHANGE_ROUTER = 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8;
    address GMX_V2_DEPOSIT_VAULT = 0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55;
    address GMX_V2_WITHDRAWAL_VAULT = 0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55;
    address GM_ETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;
    address GMX_V2_KEEPER = 0xE47b36382DC50b90bCF6176Ddb159C4b9333A7AB;
    address ETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    //TODO: add whitelisting
    //TODO: can you create a small doc (can be a test file
    function _deposit(address gmToken, address depositedToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) internal returns (bytes[] memory) {
        IERC20(depositedToken).approve(GMX_V2_ROUTER, tokenAmount);

        bytes[] memory data = new bytes[](3);

        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            GMX_V2_DEPOSIT_VAULT,
            executionFee
        );
        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            depositedToken,
            GMX_V2_DEPOSIT_VAULT,
            tokenAmount
        );
        data[2] = abi.encodeWithSelector(
            IDepositUtils.createDeposit.selector,
            IDepositUtils.CreateDepositParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: gmToken, //market
                initialLongToken: ETH, //initialLongToken
                initialShortToken: USDC, //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 100000 //callbackGasLimit
            })
        );

        bytes[] memory results = BasicMulticall(GMX_V2_EXCHANGE_ROUTER).multicall{ value: msg.value }(data);

        //TODO: pause the Prime Account
        //TODO: add to owned assets (once we have a feed)
        return results;
    }

    //TODO: withdrawal guard
    function _withdraw(address gmToken, uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) internal returns (bytes[] memory) {
        bytes[] memory data = new bytes[](3);

        IERC20(gmToken).approve(GMX_V2_ROUTER, gmAmount);

        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            GMX_V2_WITHDRAWAL_VAULT,
            executionFee
        );

        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            gmToken,
            GMX_V2_WITHDRAWAL_VAULT,
            gmAmount
        );

        data[2] = abi.encodeWithSelector(
            IWithdrawalUtils.createWithdrawal.selector,
            IWithdrawalUtils.CreateWithdrawalParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: gmToken, //market
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minLongTokenAmount: minLongTokenAmount,
                minShortTokenAmount: minShortTokenAmount,
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 100000 //callbackGasLimit
            })
        );

        bytes[] memory results = BasicMulticall(GMX_V2_EXCHANGE_ROUTER).multicall{ value: msg.value }(data);

        //TODO: pause the Prime Account
        //TODO: remove owned assets (once we have a feed)
        return results;
    }

    function depositEthUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable nonReentrant onlyOwner noBorrowInTheSameBlock recalculateAssetsExposure remainsSolvent {
        address _depositedToken = isLongToken ? ETH : USDC;

        _deposit(GM_ETH_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable nonReentrant onlyOwnerOrInsolvent noBorrowInTheSameBlock recalculateAssetsExposure {
        _withdraw(GM_ETH_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        //TODO: recalculate asset exposure
        //TODO: add assets
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        //TODO: add assets (deposited in previous tx)
    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        //TODO: recalculate asset exposure
        //TODO: add assets
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        //TODO: add assets (deposited in previous tx)
    }

    //TODO: probably not a good solution
    modifier onlyGmxV2Keeper() {
        require(msg.sender == GMX_V2_KEEPER, "Must be a GMX V2 Keeper");
        _;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
