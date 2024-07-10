// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./GmxV2FacetCommon.sol";

abstract contract GmxV2PlusFacet is GmxV2FacetCommon {
    using TransferHelper for address;

    modifier whitelistedOnly() {
        require(
            msg.sender == 0x0E5Bad4108a6A5a8b06820f98026a7f3A77466b2 ||
            msg.sender == 0xC29ee4509F01e3534307645Fc62F30Da3Ec65751 ||
            msg.sender == 0x7E2C435B8319213555598274FAc603c4020B94CB ||
            msg.sender == 0x413324ff183be1b94D09f6E1c1339E1abC09537A ||
            msg.sender == 0xC6ba6BB819f1Be84EFeB2E3f2697AD9818151e5D ||
            msg.sender == 0xec5A44cEe773D04D0EFF4092B86838d5Cd77eC4E ||
            msg.sender == 0x12DaADd9064e441C36149eC8ba160439A62b05Ee ||
            msg.sender == 0x973Ba299DF591044bf6Adc0Ca04AfBf77D9F9414 ||
            msg.sender == 0xbc809291C200dF7Cb81D3B9bA34DB4327446A832 ||
            msg.sender == 0xE1804DF460cBeb866e90424eDA5c50c41488Ffd0 ||
            msg.sender == 0x413324ff183be1b94D09f6E1c1339E1abC09537A ||
            msg.sender == 0xec5A44cEe773D04D0EFF4092B86838d5Cd77eC4E ||
            msg.sender == 0x7E2C435B8319213555598274FAc603c4020B94CB,
            "!whitelisted"
        );
        _;
    }

    // Mappings
    function marketToToken(
        address market
    ) internal pure virtual returns (address);

    function _deposit(
        address gmToken,
        uint256 tokenAmount,
        uint256 minGmAmount,
        uint256 executionFee
    ) internal whitelistedOnly nonReentrant noBorrowInTheSameBlock onlyOwner {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        address depositedToken = marketToToken(gmToken);
        tokenAmount = IERC20(depositedToken).balanceOf(address(this)) < tokenAmount
            ? IERC20(depositedToken).balanceOf(address(this))
            : tokenAmount;

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
                initialLongToken: depositedToken, //initialLongToken
                initialShortToken: depositedToken, //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 500000 //callbackGasLimit
            })
        );

        depositedToken.safeApprove(getGmxV2Router(), 0);
        depositedToken.safeApprove(getGmxV2Router(), tokenAmount);
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{value: msg.value}(data);

        // Simulate solvency check
        {
            bytes32[] memory dataFeedIds = new bytes32[](2);
            dataFeedIds[0] = tokenManager.tokenAddressToSymbol(gmToken);
            dataFeedIds[1] = tokenManager.tokenAddressToSymbol(depositedToken);

            uint256 gmTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[0];
            uint256 depositTokenUsdPrice = SolvencyMethods.getPrices(dataFeedIds)[1];
            require(
                isWithinBounds(
                    (depositTokenUsdPrice * tokenAmount) /
                        10 ** IERC20Metadata(depositedToken).decimals(), // Deposit Amount In USD
                    (minGmAmount * gmTokenUsdPrice) /
                        10 ** IERC20Metadata(gmToken).decimals()
                ), // Output Amount In USD
                "Invalid min output value"
            );

            uint256 gmTokensWeightedUsdValue = (gmTokenUsdPrice *
                minGmAmount *
                tokenManager.debtCoverage(gmToken)) /
                (10 ** IERC20Metadata(gmToken).decimals() * 1e8);
            require(
                (_getThresholdWeightedValuePayable() + gmTokensWeightedUsdValue) >
                    _getDebtPayable(),
                "The action may cause the account to become insolvent"
            );
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        tokenManager.increasePendingExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            address(this),
            (minGmAmount * 1e18) / 10 ** IERC20Metadata(gmToken).decimals()
        );

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(depositedToken),
            (tokenAmount * 1e18) / 10 ** IERC20Metadata(depositedToken).decimals()
        );

        // Update owned assets
        if (IERC20Metadata(depositedToken).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(
                tokenManager.tokenAddressToSymbol(depositedToken)
            );
        }
    }

    function _withdraw(
        address gmToken,
        uint256 gmAmount,
        uint256 minLongTokenAmount,
        uint256 minShortTokenAmount,
        uint256 executionFee
    )
        internal
        whitelistedOnly
        nonReentrant
        noBorrowInTheSameBlock
        onlyOwnerNoStaySolventOrInsolventPayable
    {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        gmAmount = IERC20(gmToken).balanceOf(address(this)) < gmAmount
            ? IERC20(gmToken).balanceOf(address(this))
            : gmAmount;

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
        BasicMulticall(getGmxV2ExchangeRouter()).multicall{value: msg.value}(data);

        address longToken = marketToToken(gmToken);
        address shortToken = marketToToken(gmToken);

        // Simulate solvency check
        if (msg.sender == DiamondStorageLib.contractOwner()) {
            // Only owner can call this method or else it's liquidator when the account is already insolvent
            uint256[] memory tokenPrices;

            {
                bytes32[] memory tokenSymbols = new bytes32[](3);
                tokenSymbols[0] = tokenManager.tokenAddressToSymbol(longToken);
                tokenSymbols[1] = tokenManager.tokenAddressToSymbol(shortToken);
                tokenSymbols[2] = tokenManager.tokenAddressToSymbol(gmToken);
                tokenPrices = getPrices(tokenSymbols);
            }
            require(
                isWithinBounds(
                    (tokenPrices[2] * gmAmount) /
                        10 ** IERC20Metadata(gmToken).decimals(), // Deposit Amount In USD
                    (tokenPrices[0] * minLongTokenAmount) /
                        10 ** IERC20Metadata(longToken).decimals() +
                        (tokenPrices[1] * minShortTokenAmount) /
                        10 ** IERC20Metadata(shortToken).decimals()
                ), // Output Amount In USD
                "Invalid min output value"
            );

            uint256 receivedTokensWeightedUsdValue = (((tokenPrices[0] *
                minLongTokenAmount *
                tokenManager.debtCoverage(longToken)) /
                10 ** IERC20Metadata(longToken).decimals()) +
                ((tokenPrices[1] *
                    minShortTokenAmount *
                    tokenManager.debtCoverage(shortToken)) /
                    10 ** IERC20Metadata(shortToken).decimals())) / 1e8;
            require(
                (_getThresholdWeightedValuePayable() + receivedTokensWeightedUsdValue) >
                    _getDebtPayable(),
                "The action may cause the account to become insolvent"
            );
        }

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        tokenManager.increasePendingExposure(
            tokenManager.tokenAddressToSymbol(longToken),
            address(this),
            (minLongTokenAmount * 1e18) / 10 ** IERC20Metadata(longToken).decimals()
        );
        tokenManager.increasePendingExposure(
            tokenManager.tokenAddressToSymbol(shortToken),
            address(this),
            (minShortTokenAmount * 1e18) / 10 ** IERC20Metadata(shortToken).decimals()
        );

        // Update exposures
        tokenManager.decreaseProtocolExposure(
            tokenManager.tokenAddressToSymbol(gmToken),
            (gmAmount * 1e18) / 10 ** IERC20Metadata(gmToken).decimals()
        );

        // Remove GM token from owned assets if whole balance was used
        if (IERC20Metadata(gmToken).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(
                tokenManager.tokenAddressToSymbol(gmToken)
            );
        }
    }
}
