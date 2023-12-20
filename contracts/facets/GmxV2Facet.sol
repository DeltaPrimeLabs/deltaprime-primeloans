// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IWrappedNativeToken.sol";

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

    // GMX contracts
    function getGmxV2Router() internal pure virtual returns (address);

    function getGmxV2ExchangeRouter() internal pure virtual returns (address);

    function getGmxV2DepositVault() internal pure virtual returns (address);

    function getGmxV2WithdrawalVault() internal pure virtual returns (address);

    function getGmxV2RoleStore() internal pure virtual returns (address);

    // Mappings
    function marketToLongToken(address market) internal virtual pure returns (address);

    function marketToShortToken(address market) internal virtual pure returns (address);

    function isCallerAuthorized(address _caller) internal view returns (bool){
        IRoleStore roleStore = IRoleStore(getGmxV2RoleStore());
        if(roleStore.hasRole(_caller, CONTROLLER)){
            return true;
        }
        return false;
    }


    function _deposit(address gmToken, address depositedToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) internal nonReentrant noBorrowInTheSameBlock onlyOwner {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        tokenAmount = IERC20(depositedToken).balanceOf(address(this)) < tokenAmount ? IERC20(depositedToken).balanceOf(address(this)) : tokenAmount;

        bytes[] memory data = new bytes[](3);
        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGmxV2DepositVault(),
            executionFee
        );
        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            depositedToken,
            getGmxV2DepositVault(),
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
                callbackGasLimit: 300000 //callbackGasLimit
            })
        );

        IERC20(depositedToken).approve(getGmxV2Router(), tokenAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{ value: msg.value }(data);

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


    function _withdraw(address gmToken, uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) internal nonReentrant noBorrowInTheSameBlock onlyOwnerNoStaySolventOrInsolventPayable {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        gmAmount = IERC20(gmToken).balanceOf(address(this)) < gmAmount ? IERC20(gmToken).balanceOf(address(this)) : gmAmount;

        bytes[] memory data = new bytes[](3);
        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGmxV2WithdrawalVault(),
            executionFee
        );

        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            gmToken,
            getGmxV2WithdrawalVault(),
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
                callbackGasLimit: 300000 //callbackGasLimit
            })
        );

        IERC20(gmToken).approve(getGmxV2Router(), gmAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{ value: msg.value }(data);

        // Simulate solvency check
        if(msg.sender == DiamondStorageLib.contractOwner()){    // Only owner can call this method or else it's liquidator when the account is already insolvent
            address longToken = marketToLongToken(gmToken);
            address shortToken = marketToShortToken(gmToken);
            uint256[] memory receivedTokensPrices = new uint256[](2);

            {
                bytes32[] memory receivedTokensSymbols = new bytes32[](2);
                receivedTokensSymbols[0] = tokenManager.tokenAddressToSymbol(longToken);
                receivedTokensSymbols[1] = tokenManager.tokenAddressToSymbol(shortToken);
                receivedTokensPrices = getPrices(receivedTokensSymbols);
            }

            uint256 receivedTokensWeightedUsdValue = (
                (receivedTokensPrices[0] * minLongTokenAmount * tokenManager.debtCoverage(longToken) * 1e18 / 10**IERC20Metadata(longToken).decimals()) +
                (receivedTokensPrices[1] * minShortTokenAmount * tokenManager.debtCoverage(shortToken) * 1e18 / 10**IERC20Metadata(shortToken).decimals())
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

    function wrapNativeToken() internal {
        if(address(this).balance > 0){
            IWrappedNativeToken nativeToken = IWrappedNativeToken(DeploymentConstants.getNativeToken());
            nativeToken.deposit{value : address(this).balance}();
            DiamondStorageLib.addOwnedAsset(DeploymentConstants.getNativeTokenSymbol(), DeploymentConstants.getNativeToken());
        }
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        uint256 gmTokenInitialBalance = IERC20Metadata(deposit.addresses.market).balanceOf(address(this));
        // Add owned assets
        if( gmTokenInitialBalance > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(deposit.addresses.market), deposit.addresses.market);
        }

        wrapNativeToken();

        // Unfreeze account
        DiamondStorageLib.unfreezeAccount(msg.sender);

        emit DepositExecuted(
            msg.sender,
            deposit.addresses.market,
            IERC20Metadata(deposit.addresses.market).balanceOf(address(this)) - gmTokenInitialBalance,
            deposit.numbers.executionFee
        );
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

        wrapNativeToken();

        DiamondStorageLib.unfreezeAccount(msg.sender);
        emit DepositCancelled(
            msg.sender,
            deposit.addresses.market,
            deposit.numbers.executionFee
        );
    }

    function afterWithdrawalExecution(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(withdrawal.addresses.market);
        address shortToken = marketToShortToken(withdrawal.addresses.market);
        uint256 longTokenInitialBalance = IERC20Metadata(longToken).balanceOf(address(this));
        uint256 shortTokenInitialBalance = IERC20Metadata(shortToken).balanceOf(address(this));

        // Add owned assets
        if(IERC20Metadata(longToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }

        wrapNativeToken();

        DiamondStorageLib.unfreezeAccount(msg.sender);
        emit WithdrawalExecuted(
            msg.sender,
            withdrawal.addresses.market,
            IERC20Metadata(longToken).balanceOf(address(this)) - longTokenInitialBalance,
            IERC20Metadata(shortToken).balanceOf(address(this)) - shortTokenInitialBalance,
            withdrawal.numbers.executionFee
        );
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        // Add owned assets
        if(IERC20Metadata(withdrawal.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(withdrawal.addresses.market), withdrawal.addresses.market);
        }

        wrapNativeToken();

        DiamondStorageLib.unfreezeAccount(msg.sender);
        emit WithdrawalCancelled(
            msg.sender,
            withdrawal.addresses.market,
            withdrawal.numbers.executionFee
        );
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

    /**
     * @dev emitted after depositing collateral to gm market
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param gmAmount amount of gm tokens received
     * @param executionFee amount of execution fee paid
    **/
    event DepositExecuted(address indexed accountAddress, address indexed market, uint256 gmAmount, uint256 executionFee);

    /**
     * @dev emitted after gm market deposit order was cancelled
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param executionFee amount of execution fee paid
    **/
    event DepositCancelled(address indexed accountAddress, address indexed market, uint256 executionFee);

    /**
     * @dev emitted after withdrawing collateral from gm market
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param longTokenAmount amount of long tokens received
     * @param shortTokenAmount amount of short tokens received
     * @param executionFee amount of execution fee paid
    **/
    event WithdrawalExecuted(address indexed accountAddress, address indexed market, uint256 longTokenAmount, uint256 shortTokenAmount, uint256 executionFee);

    /**
     * @dev emitted after gm market withdrawal order was cancelled
     * @param accountAddress address of a SmartLoanDiamondBeacon
     * @param market address of a gm market
     * @param executionFee amount of execution fee paid
    **/
    event WithdrawalCancelled(address indexed accountAddress, address indexed market, uint256 executionFee);
}
