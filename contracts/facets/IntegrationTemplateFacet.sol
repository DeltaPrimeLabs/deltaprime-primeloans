// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/IIntegrationPool.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract IntegrationFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // Used to deposit/withdraw tokens
    address private constant INTEGRATION_POOL_ADDRESS = 0x58e57cA18B7A47112b877E31929798Cd3D703b0f;
    // integration name of the pool
    bytes32 private constant INTEGRATION_TOKEN_SYMBOL = "integration_symbol_by_redstone";

    /**
     * Stakes tokens into  pool
     * @param amounts amounts of tokens to be staked
     **/
    function stake(uint256[5] memory amounts) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        address integrationTokenAddress = DeploymentConstants.getTokenManager().getAssetAddress(INTEGRATION_TOKEN_SYMBOL, false);
        IERC20 integrationToken = IERC20(integrationTokenAddress);
        uint256 initialIntegrationBalance = integrationToken.balanceOf(address(this));

        bool allZero = true;
        uint256 numStakeTokens;
        for (uint256 i; i < 5; ++i ) {
            IERC20 token = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), false));
            amounts[i] = Math.min(token.balanceOf(address(this)), amounts[i]);
            if (amounts[i] > 0) {
                allZero = false;
                address(token).safeApprove(INTEGRATION_POOL_ADDRESS, 0);
                address(token).safeApprove(INTEGRATION_POOL_ADDRESS, amounts[i]);
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

        IIntegrationPool(INTEGRATION_POOL_ADDRESS).add_liquidity(amounts, 0);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(INTEGRATION_TOKEN_SYMBOL, integrationTokenAddress);
        for (uint256 i; i < 5; ++i ) {
            IERC20 token = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), false));
            if (amounts[i] > 0 && token.balanceOf(address(this)) == 0) {
                DiamondStorageLib.removeOwnedAsset(getTokenSymbol(i));
            }
        }

        emit Staked(
            msg.sender,
            stakedAssets,
            integrationTokenAddress,
            stakedAmounts,
            integrationToken.balanceOf(address(this)) - initialIntegrationBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes tokens from Integration IntegrationVaultName pool
     * @param amount amount of token to be unstaked
     **/
    function unstakeIntegration(uint256 amount, uint256[5] memory min_amounts) external nonReentrant onlyOwnerOrInsolvent recalculateAssetsExposure {
        IIntegrationPool pool = IIntegrationPool(INTEGRATION_POOL_ADDRESS);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address integrationTokenAddress = tokenManager.getAssetAddress(INTEGRATION_TOKEN_SYMBOL, true);
        IERC20 integrationToken = IERC20(integrationTokenAddress);
        uint256 integrationTokenBalance = integrationToken.balanceOf(address(this));
        uint256[5] memory initialDepositTokenBalances;
        for (uint256 i; i < 5; ++i) {
            IERC20 depositToken = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), true));
            initialDepositTokenBalances[i] = depositToken.balanceOf(address(this));
        }
        amount = Math.min(integrationTokenBalance, amount);

        integrationTokenAddress.safeApprove(INTEGRATION_POOL_ADDRESS, 0);
        integrationTokenAddress.safeApprove(INTEGRATION_POOL_ADDRESS, amount);
        pool.remove_liquidity(amount, min_amounts);

        // Add/remove owned tokens
        uint256[5] memory unstakedAmounts;
        for (uint256 i; i < 5; ++i) {
            IERC20 depositToken = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), true));
            unstakedAmounts[i] = depositToken.balanceOf(address(this)) - initialDepositTokenBalances[i];
            DiamondStorageLib.addOwnedAsset(getTokenSymbol(i), address(depositToken));
        }
        uint256 newIntegrationTokenBalance = integrationToken.balanceOf(address(this));
        if(newIntegrationTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(INTEGRATION_TOKEN_SYMBOL);
        }

        emit Unstaked(
            msg.sender,
            getTokenSymbols(),
            integrationTokenAddress,
            unstakedAmounts,
            integrationTokenBalance - newIntegrationTokenBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes one token from Integration atricrypto pool
     * @param i index of token to be unstaked
     * @param amount amount of token to be unstaked
     **/
    function unstakeOneTokenIntegration(uint256 i, uint256 amount) external nonReentrant onlyOwnerOrInsolvent recalculateAssetsExposure {
        require(i < 5, "Invalid token index");
        IIntegrationPool pool = IIntegrationPool(INTEGRATION_POOL_ADDRESS);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address integrationTokenAddress = tokenManager.getAssetAddress(INTEGRATION_TOKEN_SYMBOL, true);
        IERC20 integrationToken = IERC20(integrationTokenAddress);
        IERC20 depositToken = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), true));
        uint256 initialDepositTokenBalance = depositToken.balanceOf(address(this));
        uint256 integrationTokenBalance = integrationToken.balanceOf(address(this));
        uint256 maxWithdrawAmount = pool.calc_withdraw_one_coin(integrationTokenBalance, i);
        amount = Math.min(maxWithdrawAmount, amount);

        uint256 burnAmount = integrationTokenBalance * amount / maxWithdrawAmount;
        integrationTokenAddress.safeApprove(INTEGRATION_POOL_ADDRESS, 0);
        integrationTokenAddress.safeApprove(INTEGRATION_POOL_ADDRESS, burnAmount);
        pool.remove_liquidity_one_coin(burnAmount, i, 0);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(getTokenSymbol(i), address(depositToken));
        uint256 newIntegrationTokenBalance = integrationToken.balanceOf(address(this));
        if(newIntegrationTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(INTEGRATION_TOKEN_SYMBOL);
        }

        emit UnstakedOneToken(
            msg.sender,
            getTokenSymbol(i),
            integrationTokenAddress,
            depositToken.balanceOf(address(this)) - initialDepositTokenBalance,
            integrationTokenBalance - newIntegrationTokenBalance,
            block.timestamp
        );
    }

    // INTERNAL FUNCTIONS

    function getTokenSymbols() internal pure returns (bytes32[5] memory tokenSymbols) {
        tokenSymbols = [
            bytes32("integrationToken1")
        ];
    }

    function getTokenSymbol(uint256 i) internal pure returns (bytes32) {
        return getTokenSymbols()[i];
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

    /**
        * @dev emitted when user stakes assets
        * @param user the address executing staking
        * @param assets the assets that were staked
        * @param vault address of the vault token
        * @param depositTokenAmounts how much of deposit tokens was staked
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes assets
        * @param user the address executing staking
        * @param assets the assets that were unstaked
        * @param vault address of the vault token
        * @param depositTokenAmounts how much of deposit tokens was received
        * @param receiptTokenAmount how much of receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32[5] assets, address indexed vault, uint256[5] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param vault address of the vault token
        * @param asset the asset that was unstaked
        * @param depositTokenAmount how much deposit token was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event UnstakedOneToken(address indexed user, bytes32 indexed asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);
}
