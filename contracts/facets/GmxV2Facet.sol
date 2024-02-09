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
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        IERC20(depositedToken).approve(getGmxV2Router(), tokenAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{ value: msg.value }(data);

        // Simulate solvency check
        {
            bytes32[] memory dataFeedIds = new bytes32[](2);
            dataFeedIds[0] = tokenManager.tokenAddressToSymbol(gmToken);
            dataFeedIds[1] = tokenManager.tokenAddressToSymbol(depositedToken);

            uint256 gmTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[0];
            uint256 depositTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[1];
            require(isWithinBounds(
                depositTokenUsdPrice * tokenAmount / 10**IERC20Metadata(depositedToken).decimals(),  // Deposit Amount In USD
                minGmAmount * gmTokenUsdPrice / 10**IERC20Metadata(gmToken).decimals())                                                // Output Amount In USD
            , "Invalid min output value");

            uint256 gmTokensWeightedUsdValue = gmTokenUsdPrice * minGmAmount * tokenManager.debtCoverage(gmToken) / 1e26;
            require((_getThresholdWeightedValuePayable() + gmTokensWeightedUsdValue) > _getDebtPayable(), "The action may cause the account to become insolvent");
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);
        
        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(gmToken), address(this), minGmAmount * 1e18 / 10**IERC20Metadata(gmToken).decimals());

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(depositedToken),
            tokenAmount * 1e18 / 10**IERC20Metadata(depositedToken).decimals()
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
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        IERC20(gmToken).approve(getGmxV2Router(), gmAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{ value: msg.value }(data);

        address longToken = marketToLongToken(gmToken);
        address shortToken = marketToShortToken(gmToken);

        // Simulate solvency check
        if(msg.sender == DiamondStorageLib.contractOwner()){    // Only owner can call this method or else it's liquidator when the account is already insolvent
            uint256[] memory tokenPrices = new uint256[](2);

            {
                bytes32[] memory tokenSymbols = new bytes32[](3);
                tokenSymbols[0] = tokenManager.tokenAddressToSymbol(longToken);
                tokenSymbols[1] = tokenManager.tokenAddressToSymbol(shortToken);
                tokenSymbols[2] = tokenManager.tokenAddressToSymbol(gmToken);
                tokenPrices = getPrices(tokenSymbols);
            }
            require(isWithinBounds(
                tokenPrices[3] * gmAmount / 10**IERC20Metadata(gmToken).decimals(),                   // Deposit Amount In USD
                tokenPrices[0] * minLongTokenAmount / 10**IERC20Metadata(longToken).decimals() 
                + tokenPrices[1] * minShortTokenAmount / 10**IERC20Metadata(shortToken).decimals())   // Output Amount In USD
            , "Invalid min output value");
            
            uint256 receivedTokensWeightedUsdValue = (
                (tokenPrices[0] * minLongTokenAmount * tokenManager.debtCoverage(longToken) * 1e18 / 10**IERC20Metadata(longToken).decimals()) +
                (tokenPrices[1] * minShortTokenAmount * tokenManager.debtCoverage(shortToken) * 1e18 / 10**IERC20Metadata(shortToken).decimals())
            )
            / 1e26;
            require((_getThresholdWeightedValuePayable() + receivedTokensWeightedUsdValue) > _getDebtPayable(), "The action may cause the account to become insolvent");
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(longToken), address(this), minLongTokenAmount * 1e18 / 10**IERC20Metadata(longToken).decimals());
        tokenManager.increasePendingExposure(tokenManager.tokenAddressToSymbol(shortToken), address(this), minShortTokenAmount * 1e18 / 10**IERC20Metadata(shortToken).decimals());

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
