// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../interfaces/ITokenManager.sol";

import "../interfaces/gmx-v2/Deposit.sol";
import "../interfaces/gmx-v2/Withdrawal.sol";
import "../interfaces/gmx-v2/Order.sol";
import "../interfaces/gmx-v2/IRoleStore.sol";
import "../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/gmx-v2/IDepositCallbackReceiver.sol";
import "../interfaces/gmx-v2/EventUtils.sol";
import "../interfaces/gmx-v2/IDepositUtils.sol";
import "../interfaces/gmx-v2/IWithdrawalUtils.sol";
import "../interfaces/gmx-v2/IGmxV2Router.sol";
import "../interfaces/gmx-v2/IWithdrawalCallbackReceiver.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

abstract contract GmxV2Facet is IDepositCallbackReceiver, IWithdrawalCallbackReceiver, ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // CONSTANTS
    bytes32 constant public CONTROLLER = keccak256(abi.encode("CONTROLLER"));
    bytes32 constant public ORDER_KEEPER = keccak256(abi.encode("ORDER_KEEPER"));
    bytes32 constant public MARKET_KEEPER = keccak256(abi.encode("MARKET_KEEPER"));
    bytes32 constant public FEE_KEEPER = keccak256(abi.encode("FEE_KEEPER"));
    bytes32 constant public FROZEN_ORDER_KEEPER = keccak256(abi.encode("FROZEN_ORDER_KEEPER"));

    // GMX contracts
    function getGMX_V2_ROUTER() internal pure virtual returns (address);

    function getGMX_V2_EXCHANGE_ROUTER() internal pure virtual returns (address);

    function getGMX_V2_DEPOSIT_VAULT() internal pure virtual returns (address);

    function getGMX_V2_WITHDRAWAL_VAULT() internal pure virtual returns (address);

    function getGMX_V2_ROLE_STORE() internal pure virtual returns (address);

    // Mappings
    function marketToLongToken(address market) internal virtual pure returns (address);

    function marketToShortToken(address market) internal virtual pure returns (address);

    function isCallerAuthorized(address _caller) internal view returns (bool){
        IRoleStore roleStore = IRoleStore(getGMX_V2_ROLE_STORE());
        // TODO: Once on prod - verify the roles of authorized signers
        if(
            roleStore.hasRole(_caller, CONTROLLER) ||
            roleStore.hasRole(_caller, ORDER_KEEPER) ||
            roleStore.hasRole(_caller, MARKET_KEEPER) ||
            roleStore.hasRole(_caller, FEE_KEEPER) ||
            roleStore.hasRole(_caller, FROZEN_ORDER_KEEPER)
        ){
            return true;
        }
        return false;
    }


    function _deposit(address gmToken, address depositedToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) internal nonReentrant noBorrowInTheSameBlock onlyOwner {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes[] memory data = new bytes[](3);
        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGMX_V2_DEPOSIT_VAULT(),
            executionFee
        );
        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            depositedToken,
            getGMX_V2_DEPOSIT_VAULT(),
            tokenAmount
        );
        data[2] = abi.encodeWithSelector(
            IDepositUtils.createDeposit.selector,
            IDepositUtils.CreateDepositParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: gmToken, //market
                initialLongToken: marketToLongToken(gmToken), //initialLongToken
                initialShortToken: marketToShortToken(gmToken), //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 200000 //callbackGasLimit
            })
        );

        IERC20(depositedToken).approve(getGMX_V2_ROUTER(), tokenAmount);
        BasicMulticall(getGMX_V2_EXCHANGE_ROUTER()).multicall{ value: msg.value }(data);

        // Simulate solvency check
        {
            bytes32[] memory dataFeedIds = new bytes32[](1);
            dataFeedIds[0] = tokenManager.tokenAddressToSymbol(gmToken);
            uint256 gmTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[0];
            uint256 gmTokensWeightedUsdValue = gmTokenUsdPrice * minGmAmount * tokenManager.debtCoverage(gmToken) / 1e26;
            require((_getThresholdWeightedValuePayable() + gmTokensWeightedUsdValue) > _getDebtPayable(), "The action may cause the account to become insolvent");
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(depositedToken),
            tokenAmount * 1e18 / 10**IERC20Metadata(depositedToken).decimals()
        );
        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            minGmAmount * 1e18 / 10**IERC20Metadata(gmToken).decimals()
        );

        // Update owned assets
        if(IERC20Metadata(depositedToken).balanceOf(address(this)) == 0){
            DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(depositedToken));
        }
    }


    function _withdraw(address gmToken, uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) internal nonReentrant noBorrowInTheSameBlock onlyOwnerNoStaySolventOrInsolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        bytes[] memory data = new bytes[](3);
        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGMX_V2_WITHDRAWAL_VAULT(),
            executionFee
        );

        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            gmToken,
            getGMX_V2_WITHDRAWAL_VAULT(),
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
                callbackGasLimit: 200000 //callbackGasLimit
            })
        );

        IERC20(gmToken).approve(getGMX_V2_ROUTER(), gmAmount);
        BasicMulticall(getGMX_V2_EXCHANGE_ROUTER()).multicall{ value: msg.value }(data);

        // Simulate solvency check
        {
            address longToken = marketToLongToken(gmToken);
            address shortToken = marketToShortToken(gmToken);
            bytes32[] memory receivedTokensSymbols = new bytes32[](2);
            uint256[] memory receivedTokensPrices = new uint256[](2);

            receivedTokensSymbols[0] = tokenManager.tokenAddressToSymbol(longToken);
            receivedTokensSymbols[1] = tokenManager.tokenAddressToSymbol(shortToken);
            receivedTokensPrices = getPrices(receivedTokensSymbols);

            uint256 receivedTokensWeightedUsdValue = (
                (receivedTokensPrices[0] * minLongTokenAmount * tokenManager.debtCoverage(longToken)) +
                (receivedTokensPrices[1] * minShortTokenAmount * tokenManager.debtCoverage(shortToken))
            )
            / 1e26;
            require((_getThresholdWeightedValuePayable() + receivedTokensWeightedUsdValue) > _getDebtPayable(), "The action may cause the account to become insolvent");
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            gmAmount * 1e18 / 10**IERC20Metadata(gmToken).decimals()
        );
        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(marketToLongToken(gmToken)),
            minLongTokenAmount * 1e18 / 10**IERC20Metadata(marketToLongToken(gmToken)).decimals()
        );
        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(marketToShortToken(gmToken)),
            minShortTokenAmount * 1e18 / 10**IERC20Metadata(marketToShortToken(gmToken)).decimals()
        );

        // Remove GM token from owned assets if whole balance was used
        if(IERC20Metadata(gmToken).balanceOf(address(this)) == 0){
            DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(gmToken));
        }
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        // Add owned assets
        if(IERC20Metadata(deposit.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(deposit.addresses.market), deposit.addresses.market);
        }

        // Unfreeze account
        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(deposit.addresses.market);
        address shortToken = marketToShortToken(deposit.addresses.market);

        // Add owned assets
        if(IERC20Metadata(longToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }

        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(withdrawal.addresses.market);
        address shortToken = marketToShortToken(withdrawal.addresses.market);

        // Add owned assets
        if(IERC20Metadata(longToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }

        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        // Add owned assets
        if(IERC20Metadata(withdrawal.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(withdrawal.addresses.market), withdrawal.addresses.market);
        }

        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    // MODIFIERS
    modifier onlyGmxV2Keeper() {
        require(isCallerAuthorized(msg.sender), "Must be a GMX V2 authorized Keeper");
        _;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
