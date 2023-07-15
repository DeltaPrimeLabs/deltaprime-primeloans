// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../lib/SolvencyMethods.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/ITokenManager.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/arbitrum/IConvexPool.sol";
import "../../interfaces/arbitrum/IConvexRewarder.sol";

contract ConvexFacetArbi is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address;

    // Curve
    // TODO: Add to TokenManager
    address public constant CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS = 0x8e0B8c8BB9db49a46697F3a5Bb8A308e744821D2;
    // TODO: Add to TokenManager
    address public constant CRV_TOKEN_ADDRESS = 0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978;

    // Convex
    // TODO: Add to TokenManager
    address public constant CVX_TOKEN_ADDRESS = 0xb952A807345991BD529FDded05009F5e80Fe8F45;
    // TODO: Add to TokenManager
    address public constant CVX_USD_BTC_ETH_LP_TOKEN_ADDRESS = 0xA9249f8667cb120F065D9dA1dCb37AD28E1E8FF0;

    address public constant DEPOSIT_CONTRACT_USD_BTC_ETH_ADDRESS = 0xF403C135812408BFbE8713b5A23a04b3D48AAE31;
    uint256 public constant USD_BTC_ETH_POOL_ID = 8;

    function depositAndStakeUsdBtcEth(uint256 lpTokensAmount) external returns (uint256){
        return _depositAndStake(lpTokensAmount, USD_BTC_ETH_POOL_ID, DEPOSIT_CONTRACT_USD_BTC_ETH_ADDRESS, CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS, "CRV_USD_BTC_ETH", CVX_USD_BTC_ETH_LP_TOKEN_ADDRESS, "CVX_USD_BTC_ETH");
    }

    function withdrawAndClaimUsdBtcEth(uint256 receiptTokenAmount) external returns(uint256){
        return _withdrawAndClaim(receiptTokenAmount, CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS, "CRV_USD_BTC_ETH", CVX_USD_BTC_ETH_LP_TOKEN_ADDRESS, "CVX_USD_BTC_ETH");
    }

    function _depositAndStake(uint256 _crvLpTokenAmount, uint256 _depositPoolId, address _depositPoolAddress, address crvLpTokenAddress, bytes32 crvLpTokenIdentifier, address cvxPoolLPTokenAddress, bytes32 cvxPoolIdentifier) internal onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent returns (uint256){
        IERC20Metadata crvLpToken = IERC20Metadata(CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS);
        IERC20Metadata cvxLpToken = IERC20Metadata(cvxPoolLPTokenAddress);
        IConvexPool cvxPool = IConvexPool(_depositPoolAddress);

        uint256 initialReceiptTokenBalance = cvxLpToken.balanceOf(address(this));

        _crvLpTokenAmount = Math.min(crvLpToken.balanceOf(address(this)), _crvLpTokenAmount);
        require(_crvLpTokenAmount > 0, "Cannot stake 0 tokens");

        address(crvLpToken).safeApprove(address(cvxPool), 0);
        address(crvLpToken).safeApprove(address(cvxPool), _crvLpTokenAmount);

        cvxPool.deposit(_depositPoolId, _crvLpTokenAmount);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(cvxPoolIdentifier, cvxLpToken);
        if(crvLpToken.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(crvLpTokenIdentifier);
        }

        uint256 receiptTokenReceivedAmount = cvxLpToken.balanceOf(address(this)) - initialReceiptTokenBalance;
        emit Staked(
            msg.sender,
            crvLpTokenIdentifier,
            _depositPoolAddress,
            _crvLpTokenAmount,
            receiptTokenReceivedAmount,
            block.timestamp);

        return receiptTokenReceivedAmount;
    }

    function _withdrawAndClaim(uint256 _receiptTokenAmount, address crvLpTokenAddress, bytes32 crvLpTokenIdentifier, address cvxPoolLPTokenAddress, bytes32 cvxPoolIdentifier) internal onlyOwner nonReentrant recalculateAssetsExposure remainsSolvent returns (uint256){
        IERC20Metadata crvLpToken = IERC20Metadata(CRV_USD_BTC_ETH_LP_TOKEN_ADDRESS);
        IERC20Metadata crvToken = IERC20Metadata(CRV_TOKEN_ADDRESS);
        IERC20Metadata cvxToken = IERC20Metadata(CVX_TOKEN_ADDRESS);
        IConvexRewarder cvxRewarder = IConvexRewarder(cvxPoolLPTokenAddress);

        uint256 initialDepositTokenBalance = crvLpToken.balanceOf(address(this));
        _receiptTokenAmount = Math.min(cvxRewarder.balanceOf(address(this)), _receiptTokenAmount);

        // Always claim (true) rewards upon withdrawal
        cvxRewarder.withdraw(_receiptTokenAmount, true);

        // Curve LP token
        DiamondStorageLib.addOwnedAsset(crvLpTokenIdentifier, crvLpTokenAddress);

        // Add reward tokens if any were claimed
        if(crvToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("CRV", CRV_TOKEN_ADDRESS);
        }
        if(cvxToken.balanceOf(address(this)) > 0) {
            DiamondStorageLib.addOwnedAsset("CVX", CVX_TOKEN_ADDRESS);
        }

        uint256 depositTokenReceivedAmount = crvLpToken.balanceOf(address(this)) - initialDepositTokenBalance;

        emit Unstaked(
            msg.sender,
            crvLpTokenIdentifier,
            cvxPoolLPTokenAddress,
            depositTokenReceivedAmount,
            _receiptTokenAmount,
            block.timestamp);


        return depositTokenReceivedAmount;
    }

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset the asset that was staked
        * @param vault address of the vault token
        * @param depositTokenAmount how much of deposit token was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param vault address of the vault token
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

}
