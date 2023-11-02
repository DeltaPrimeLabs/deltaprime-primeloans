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

    address constant GMX_V2_ROUTER = 0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6;
    address constant GMX_V2_EXCHANGE_ROUTER = 0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8;
    address constant GMX_V2_DEPOSIT_VAULT = 0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55;
    address constant GMX_V2_WITHDRAWAL_VAULT = 0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55;
    address constant GMX_V2_KEEPER = 0xE47b36382DC50b90bCF6176Ddb159C4b9333A7AB;

    // Markets
    address constant GM_ETH_USDC = 0x70d95587d40A2caf56bd97485aB3Eec10Bee6336;

    // Tokens
    address constant ETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;

    modifier onlyWhitelistedAccounts {
        if(
            msg.sender == 0x0E5Bad4108a6A5a8b06820f98026a7f3A77466b2 ||
            msg.sender == 0x2fFA7E9624B923fA811d9B9995Aa34b715Db1945 ||
            msg.sender == 0x0d7137feA34BC97819f05544Ec7DE5c98617989C ||
            msg.sender == 0xC6ba6BB819f1Be84EFeB2E3f2697AD9818151e5D ||
            msg.sender == 0x14f69F9C351b798dF31fC53E33c09dD29bFAb547 ||
            msg.sender == 0x5C23Bd1BD272D22766eB3708B8f874CB93B75248 ||
            msg.sender == 0x000000F406CA147030BE7069149e4a7423E3A264 ||
            msg.sender == 0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12 ||
            msg.sender == 0xb79c2A75cd9073d68E75ddF71D53C07747Df7933 ||
            msg.sender == 0x6C21A841d6f029243AF87EF01f6772F05832144b
        ){
            _;
        } else {
            revert("Not whitelisted");
        }
    }

    function marketToLongToken(address market) internal pure returns (address){
        if(market == GM_ETH_USDC){
            return ETH;
        } else {
            revert("Market not supported");
        }
    }

    function marketToShortToken(address market) internal pure returns (address){
        if(market == GM_ETH_USDC){
            return USDC;
        } else {
            revert("Market not supported");
        }
    }

    //TODO: can you create a small doc (can be a test file
    function _deposit(address gmToken, address depositedToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) internal returns (bytes[] memory) {
        address longToken = marketToLongToken(gmToken);
        address shortToken = marketToShortToken(gmToken);

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
                initialLongToken: longToken, //initialLongToken
                initialShortToken: shortToken, //initialShortToken
                longTokenSwapPath: new address[](0), //longTokenSwapPath
                shortTokenSwapPath: new address[](0), //shortTokenSwapPath
                minMarketTokens: minGmAmount, //minMarketTokens
                shouldUnwrapNativeToken: false, //shouldUnwrapNativeToken
                executionFee: executionFee, //executionFee
                callbackGasLimit: 100000 //callbackGasLimit
            })
        );

        bytes[] memory results = BasicMulticall(GMX_V2_EXCHANGE_ROUTER).multicall{ value: msg.value }(data);

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        // Reset assets exposure
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory resetExposureAssets = new bytes32[](3);
        resetExposureAssets[0] = tokenManager.tokenAddressToSymbol(gmToken);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(longToken);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(shortToken);
        SolvencyMethods._resetPrimeAccountExposureForChosenAssets(resetExposureAssets);

        // Remove long/short token(s) from owned assets if whole balance(s) was/were used
        if(IERC20Metadata(longToken).balanceOf(address(this)) == 0){
            DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(longToken));
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) == 0){
            DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken));
        }
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

        // Freeze account
        DiamondStorageLib.freezeAccount(gmToken);

        // Reset assets exposure
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory resetExposureAssets = new bytes32[](3);
        resetExposureAssets[0] = tokenManager.tokenAddressToSymbol(gmToken);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(marketToLongToken(gmToken));
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(marketToShortToken(gmToken));
        SolvencyMethods._resetPrimeAccountExposureForChosenAssets(resetExposureAssets);

        // Remove GM token from owned assets if whole balance was used
        if(IERC20Metadata(gmToken).balanceOf(address(this)) == 0){
            DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(gmToken));
        }

        return results;
    }

    function depositEthUsdcGmxV2(bool isLongToken, uint256 tokenAmount, uint256 minGmAmount, uint256 executionFee) external payable onlyWhitelistedAccounts nonReentrant noBorrowInTheSameBlock onlyOwner {
        address _depositedToken = isLongToken ? ETH : USDC;

        _deposit(GM_ETH_USDC, _depositedToken, tokenAmount, minGmAmount, executionFee);
    }

    function withdrawEthUsdcGmxV2(uint256 gmAmount, uint256 minLongTokenAmount, uint256 minShortTokenAmount, uint256 executionFee) external payable onlyWhitelistedAccounts nonReentrant noBorrowInTheSameBlock onlyOwnerOrInsolvent {
        _withdraw(GM_ETH_USDC, gmAmount, minLongTokenAmount, minShortTokenAmount, executionFee);
    }

    function afterDepositExecution(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        // Set asset exposure
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory resetExposureAssets = new bytes32[](3);
        resetExposureAssets[0] = tokenManager.tokenAddressToSymbol(deposit.addresses.market);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(marketToLongToken(deposit.addresses.market));
        resetExposureAssets[2] = tokenManager.tokenAddressToSymbol(marketToShortToken(deposit.addresses.market));
        SolvencyMethods._setPrimeAccountExposureForChosenAssets(resetExposureAssets);
        
        // Add owned assets
        if(IERC20Metadata(deposit.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(deposit.addresses.market), deposit.addresses.market);
        }

        // Unfreeze account
        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    function afterDepositCancellation(bytes32 key, Deposit.Props memory deposit, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        address longToken = marketToLongToken(deposit.addresses.market);
        address shortToken = marketToShortToken(deposit.addresses.market);
        // Set asset exposure
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory resetExposureAssets = new bytes32[](3);
        resetExposureAssets[0] = tokenManager.tokenAddressToSymbol(deposit.addresses.market);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(longToken);
        resetExposureAssets[2] = tokenManager.tokenAddressToSymbol(shortToken);
        SolvencyMethods._setPrimeAccountExposureForChosenAssets(resetExposureAssets);

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
        address longToken = marketToLongToken(withdrawal.addresses.market);
        address shortToken = marketToShortToken(withdrawal.addresses.market);
        // Set asset exposure
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory resetExposureAssets = new bytes32[](3);
        resetExposureAssets[0] = tokenManager.tokenAddressToSymbol(withdrawal.addresses.market);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(longToken);
        resetExposureAssets[2] = tokenManager.tokenAddressToSymbol(shortToken);
        SolvencyMethods._setPrimeAccountExposureForChosenAssets(resetExposureAssets);

        // Add owned assets
        if(IERC20Metadata(longToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(longToken), longToken);
        }
        if(IERC20Metadata(shortToken).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(shortToken), shortToken);
        }

        //TODO: add assets
        DiamondStorageLib.unfreezeAccount(msg.sender);
    }

    function afterWithdrawalCancellation(bytes32 key, Withdrawal.Props memory withdrawal, EventUtils.EventLogData memory eventData) external onlyGmxV2Keeper nonReentrant override {
        // Set asset exposure
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        bytes32[] memory resetExposureAssets = new bytes32[](3);
        resetExposureAssets[0] = tokenManager.tokenAddressToSymbol(withdrawal.addresses.market);
        resetExposureAssets[1] = tokenManager.tokenAddressToSymbol(marketToLongToken(withdrawal.addresses.market));
        resetExposureAssets[2] = tokenManager.tokenAddressToSymbol(marketToShortToken(withdrawal.addresses.market));
        SolvencyMethods._setPrimeAccountExposureForChosenAssets(resetExposureAssets);

        // Add owned assets
        if(IERC20Metadata(withdrawal.addresses.market).balanceOf(address(this)) > 0){
            DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(withdrawal.addresses.market), withdrawal.addresses.market);
        }

        DiamondStorageLib.unfreezeAccount(msg.sender);
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
