// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/ICurvePool.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract CurveFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    // Used to deposit/withdraw tokens
    address private constant CURVE_POOL_ADDRESS = 0x58e57cA18B7A47112b877E31929798Cd3D703b0f;
    // crvUSDBTCETH
    bytes32 private constant CURVE_TOKEN_SYMBOL = "crvUSDBTCETH";

    /**
     * Stakes tokens in Curve atricrypto pool
     * @param amounts amounts of tokens to be staked
     **/
    function stakeCurve(uint256[5] memory amounts) external nonReentrant onlyOwnerOrInsolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        address curveTokenAddress = DeploymentConstants.getTokenManager().getAssetAddress(CURVE_TOKEN_SYMBOL, false);
        IERC20 curveToken = IERC20(curveTokenAddress);
        uint256 initialCurveBalance = curveToken.balanceOf(address(this));

        bool allZero = true;
        uint256 numStakeTokens;
        for (uint256 i; i < 5; ++i ) {
            IERC20 token = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), false));
            amounts[i] = Math.min(token.balanceOf(address(this)), amounts[i]);
            if (amounts[i] > 0) {
                allZero = false;
                token.approve(CURVE_POOL_ADDRESS, amounts[i]);
                ++numStakeTokens;
            }
        }
        require(!allZero, "Cannot stake 0 tokens");

        bytes32[] memory stakedAssets = new bytes32[](numStakeTokens);
        uint256[] memory stakedAmounts = new uint256[](numStakeTokens);
        uint256 idx;
        for (uint256 i; i < 5; ++i ) {
            if (amounts[i] > 0) {
                stakedAssets[idx] = getTokenSymbol(i);
                stakedAmounts[idx++] = amounts[i];
            }
        }

        ICurvePool(CURVE_POOL_ADDRESS).add_liquidity(amounts, 0);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(CURVE_TOKEN_SYMBOL, curveTokenAddress);
        for (uint256 i; i < 5; ++i ) {
            IERC20 token = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), false));
            if (amounts[i] > 0 && token.balanceOf(address(this)) == 0) {
                DiamondStorageLib.removeOwnedAsset(getTokenSymbol(i));
            }
        }

        emit Staked(
            msg.sender,
            stakedAssets,
            curveTokenAddress,
            stakedAmounts,
            curveToken.balanceOf(address(this)) - initialCurveBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes one token from Curve atricrypto pool
     * @param i index of token to be unstaked
     * @param amount amount of token to be unstaked
     **/
    function unstakeOneTokenCurve(uint256 i, uint256 amount) external nonReentrant onlyOwnerOrInsolvent {
        require(i < 5, "Invalid token index");
        ICurvePool pool = ICurvePool(CURVE_POOL_ADDRESS);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address curveTokenAddress = tokenManager.getAssetAddress(CURVE_TOKEN_SYMBOL, true);
        IERC20 curveToken = IERC20(curveTokenAddress);
        IERC20 depositToken = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), true));
        uint256 initialDepositTokenBalance = depositToken.balanceOf(address(this));
        uint256 curveTokenBalance = curveToken.balanceOf(address(this));
        uint256 maxWithdrawAmount = pool.calc_withdraw_one_coin(curveTokenBalance, i);
        amount = Math.min(maxWithdrawAmount, amount);

        uint256 burnAmount = curveTokenBalance * amount / maxWithdrawAmount;
        curveToken.approve(CURVE_POOL_ADDRESS, burnAmount);
        pool.remove_liquidity_one_coin(burnAmount, i, 0);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(getTokenSymbol(i), address(depositToken));
        uint256 newCurveTokenBalance = curveToken.balanceOf(address(this));
        if(newCurveTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(CURVE_TOKEN_SYMBOL);
        }

        emit Unstaked(
            msg.sender,
            getTokenSymbol(i),
            curveTokenAddress,
            depositToken.balanceOf(address(this)) - initialDepositTokenBalance,
            curveTokenBalance - newCurveTokenBalance,
            block.timestamp
        );
    }

    // INTERNAL FUNCTIONS

    function getTokenSymbol(uint256 i) internal pure returns (bytes32) {
        bytes32[5] memory tokenSymbols = [
            bytes32("DAIe"),
            bytes32("USDCe"),
            bytes32("USDTe"),
            bytes32("WBTCe"),
            bytes32("ETH")
        ];
        return tokenSymbols[i];
    }

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param assets the assets that was staked
        * @param vault address of the vault token
        * @param depositTokenAmounts how much of deposit tokens was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param vault address of the vault token
        * @param asset the asset that was unstaked
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);
}
