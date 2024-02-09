// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../ReentrancyGuardKeccak.sol";
import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import "../OnlyOwnerOrInsolvent.sol";
import "../interfaces/ITokenManager.sol";

import "../interfaces/gmx-v2/BasicMulticall.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../interfaces/gmx-v2/EventUtils.sol";
import "../interfaces/gmx-v2/IDepositUtils.sol";
import "../interfaces/gmx-v2/IWithdrawalUtils.sol";
import "../interfaces/gmx-v2/IGmxV2Router.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

abstract contract GmxV2Facet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // GMX contracts
    function getGmxV2Router() internal pure virtual returns (address);

    function getGmxV2ExchangeRouter() internal pure virtual returns (address);

    function getGmxV2DepositVault() internal pure virtual returns (address);

    function getGmxV2WithdrawalVault() internal pure virtual returns (address);

    // Mappings
    function marketToLongToken(address market) internal virtual pure returns (address);

    function marketToShortToken(address market) internal virtual pure returns (address);

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
        
        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(gmToken), minGmAmount * 1e18 / 10**IERC20Metadata(gmToken).decimals());

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

        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(marketToLongToken(gmToken)), minLongTokenAmount * 1e18 / 10**IERC20Metadata(marketToLongToken(gmToken)).decimals());
        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(marketToShortToken(gmToken)), minShortTokenAmount * 1e18 / 10**IERC20Metadata(marketToShortToken(gmToken)).decimals());

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

    // MODIFIERS
    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
