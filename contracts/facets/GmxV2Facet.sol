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

    function isWithinBounds(uint256 _estimate, uint256 _userInput) internal pure returns(bool) {
        if(_estimate * 95 / 100 <= _userInput && _estimate * 105 / 100 >= _userInput) {
            return true;
        }
        return false;
    }

    function _updateOwnedAssets(ITokenManager tokenManager, address _token, uint256 _amount) internal {
        if(_amount > 0) {
            tokenManager.decreaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(_token),
                _amount * 1e18 / 10**IERC20Metadata(_token).decimals()
            );
            if(IERC20Metadata(_token).balanceOf(address(this)) == 0){
                DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(_token));
            }
        }
    }

    function _simulateSolvencyCheck(ITokenManager tokenManager, address gmToken, uint longTokenAmount, uint shortTokenAmount, uint gmAmount, bool isDeposit) internal{
        uint256[] memory tokenPrices = new uint256[](3);
        bytes32[] memory tokenSymbols = new bytes32[](3);
        tokenSymbols[0] = tokenManager.tokenAddressToSymbol(marketToLongToken(gmToken));
        tokenSymbols[1] = tokenManager.tokenAddressToSymbol(marketToShortToken(gmToken));
        tokenSymbols[2] = tokenManager.tokenAddressToSymbol(gmToken);
        tokenPrices = getPrices(tokenSymbols);

        uint256 amount0 = tokenPrices[3] * gmAmount / 10**IERC20Metadata(gmToken).decimals();
        uint256 amount1 = tokenPrices[0] * longTokenAmount / 10**IERC20Metadata(marketToLongToken(gmToken)).decimals() + tokenPrices[1] * shortTokenAmount / 10**IERC20Metadata(marketToShortToken(gmToken)).decimals();
        (amount0, amount1) = isDeposit ? (amount1, amount0) : (amount0, amount1);
        require(isWithinBounds(amount0, amount1) , "Invalid min output value");
        
        uint256 receivedWeightedUsdValue = isDeposit ? 
            (tokenPrices[2] * gmAmount * tokenManager.debtCoverage(gmToken) * 1e18 / 10**IERC20Metadata(gmToken).decimals()) / 1e26 
        :
        (
            (tokenPrices[0] * longTokenAmount * tokenManager.debtCoverage(marketToLongToken(gmToken)) * 1e18 / 10**IERC20Metadata(marketToLongToken(gmToken)).decimals()) +
            (tokenPrices[1] * shortTokenAmount * tokenManager.debtCoverage(marketToShortToken(gmToken)) * 1e18 / 10**IERC20Metadata(marketToShortToken(gmToken)).decimals())
        )
        / 1e26;

        require((_getThresholdWeightedValuePayable() + receivedWeightedUsdValue) > _getDebtPayable(), "The action may cause the account to become insolvent");
    }

    function _deposit(address gmToken, uint256 longTokenAmount, uint256 shortTokenAmount, uint256 minGmAmount, uint256 executionFee) internal nonReentrant noBorrowInTheSameBlock onlyOwner {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address longToken = marketToLongToken(gmToken);
        address shortToken = marketToShortToken(gmToken);
        bytes[] memory data = new bytes[](3);

        data[0] = abi.encodeWithSelector(
            IGmxV2Router.sendWnt.selector,
            getGmxV2DepositVault(),
            executionFee
        );

        longTokenAmount = IERC20(longToken).balanceOf(address(this)) < longTokenAmount ? IERC20(longToken).balanceOf(address(this)) : longTokenAmount;
        shortTokenAmount = IERC20(shortToken).balanceOf(address(this)) < shortTokenAmount ? IERC20(shortToken).balanceOf(address(this)) : shortTokenAmount;

        data[1] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            longToken,
            getGmxV2DepositVault(),
            longTokenAmount
        );
        
        data[2] = abi.encodeWithSelector(
            IGmxV2Router.sendTokens.selector,
            shortToken,
            getGmxV2DepositVault(),
            shortTokenAmount
        );
        
        data[3] = abi.encodeWithSelector(
            IDepositUtils.createDeposit.selector,
            IDepositUtils.CreateDepositParams({
                receiver: address(this), //receiver
                callbackContract: address(this), //callbackContract
                uiFeeReceiver: address(0), //uiFeeReceiver
                market: gmToken, //market
                initialLongToken: longToken, //initialLongToken
                initialShortToken: shortToken, //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        if(longTokenAmount > 0) {
            IERC20(longToken).approve(getGmxV2Router(), longTokenAmount);
        }
        if(shortTokenAmount > 0) {
            IERC20(shortToken).approve(getGmxV2Router(), shortTokenAmount);
        }

        BasicMulticall(getGmxV2ExchangeRouter()).multicall{ value: msg.value }(data);

        // Simulate solvency check
        _simulateSolvencyCheck(tokenManager, gmToken, longTokenAmount, shortTokenAmount, minGmAmount, true);

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);
        
        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(gmToken), msg.sender, minGmAmount * 1e18 / 10**IERC20Metadata(gmToken).decimals());

        // Update exposures
        _updateOwnedAssets(tokenManager, longToken, longTokenAmount);
        _updateOwnedAssets(tokenManager, shortToken, shortTokenAmount);
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
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        IERC20(gmToken).approve(getGmxV2Router(), gmAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{ value: msg.value }(data);

        // Simulate solvency check
        if(msg.sender == DiamondStorageLib.contractOwner()){    // Only owner can call this method or else it's liquidator when the account is already insolvent
            _simulateSolvencyCheck(tokenManager, gmToken, minLongTokenAmount, minShortTokenAmount, gmAmount, false);
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(marketToLongToken(gmToken)), msg.sender, minLongTokenAmount * 1e18 / 10**IERC20Metadata(marketToLongToken(gmToken)).decimals());
        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(marketToShortToken(gmToken)), msg.sender, minShortTokenAmount * 1e18 / 10**IERC20Metadata(marketToShortToken(gmToken)).decimals());

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            gmAmount * 1e18 / 10**IERC20Metadata(gmToken).decimals()
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
        uint256 receivedMarketTokens = eventData.uintItems.items[0].value;
        address gmToken = deposit.addresses.market;

        uint256 gmTokenBalance = IERC20Metadata(gmToken).balanceOf(address(this));
        // Add owned assets
        if( gmTokenBalance > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(gmToken), gmToken);
        }

        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            receivedMarketTokens * 1e18 / 10**IERC20Metadata(gmToken).decimals()
        );

        tokenManager.decreasePendingExposure(tokenManager.tokenAddressToSymbol(gmToken), msg.sender);
        
        // Unfreeze account
        DiamondStorageLib.unfreezeAccount(msg.sender);

        emit DepositExecuted(
            msg.sender,
            deposit.addresses.market,
            receivedMarketTokens,
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

        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        if(deposit.numbers.initialLongTokenAmount > 0) {
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(longToken),
                deposit.numbers.initialLongTokenAmount * 1e18 / 10**IERC20Metadata(longToken).decimals()
            );
        }
        if(deposit.numbers.initialShortTokenAmount > 0) {
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(shortToken),
                deposit.numbers.initialShortTokenAmount * 1e18 / 10**IERC20Metadata(shortToken).decimals()
            );
        }

        tokenManager.decreasePendingExposure(tokenManager.tokenAddressToSymbol(deposit.addresses.market), msg.sender);

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
        if(longTokenInitialBalance > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(shortTokenInitialBalance > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }
        
        if(eventData.uintItems.items[0].value > 0) {                      // Long Token Output
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(longToken),
                eventData.uintItems.items[0].value * 1e18 / 10**IERC20Metadata(longToken).decimals()
            );
        }
        if(eventData.uintItems.items[1].value > 0) {    // Short Token Output
            tokenManager.increaseProtocolExposure(
                tokenManager.tokenAddressToSymbol(shortToken),
                eventData.uintItems.items[1].value * 1e18 / 10**IERC20Metadata(shortToken).decimals()
            );
        }

        tokenManager.decreasePendingExposure(tokenManager.tokenAddressToSymbol(longToken), msg.sender);
        tokenManager.decreasePendingExposure(tokenManager.tokenAddressToSymbol(shortToken), msg.sender);
        
        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
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
        address longToken = marketToLongToken(withdrawal.addresses.market);
        address shortToken = marketToShortToken(withdrawal.addresses.market);
        
        // Add owned assets
        if(IERC20Metadata(withdrawal.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(withdrawal.addresses.market), withdrawal.addresses.market);
        }

        // Native token transfer happens after execution of this method, but the amounts should be dust ones anyway and by wrapping here we get a chance to wrap any previously sent native token
        wrapNativeToken();

        tokenManager.increaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(withdrawal.addresses.market),
            withdrawal.numbers.marketTokenAmount * 1e18 / 10**IERC20Metadata(withdrawal.addresses.market).decimals()
        );

        tokenManager.decreasePendingExposure(tokenManager.tokenAddressToSymbol(longToken), msg.sender);
        tokenManager.decreasePendingExposure(tokenManager.tokenAddressToSymbol(shortToken), msg.sender);

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
