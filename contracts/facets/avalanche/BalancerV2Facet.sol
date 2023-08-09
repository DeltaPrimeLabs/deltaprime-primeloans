// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/IBalancerV2Vault.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/balancer-v2/IBalancerV2Vault.sol";

contract BalancerFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // Used to deposit/withdraw tokens
    address private constant BALANCER_VAULT_ADDRESS = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    /**d
     * Stakes tokens into  pool
     * @param amounts amounts of tokens to be staked
     **/
    function joinPoolAndStake(bytes32 poolId, JoinPoolRequest memory request) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        IBalancerV2Vault vault = IBalancerV2Vault(BALANCER_VAULT_ADDRESS);

        (address pool,) = vault.getPool(poolId);
        bytes32 symbol = poolToRedstoneSymbol(pool);

        uint256 initialPoolBalance = pool.balanceOf(address(this));

        bool allZero = true;
        uint256 numStakeTokens;
        for (uint256 i; i < assets.length; ++i ) {
            IERC20Metadata token = IERC20Metadata(assets[i]);
            amounts[i] = Math.min(token.balanceOf(address(this)), amounts[i]);
            if (amounts[i] > 0) {
                allZero = false;
                address(token).safeApprove(BALANCER_VAULT_ADDRESS, 0);
                address(token).safeApprove(BALANCER_VAULT_ADDRESS, amounts[i]);
                ++numStakeTokens;
            }
        }
        require(!allZero, "Cannot joinPoolAndStake 0 tokens");

        bytes32[] memory stakedAssets = new bytes32[](numStakeTokens);
        uint256[] memory stakedAmounts = new uint256[](numStakeTokens);
        uint256 idx;
        for (uint256 i; i < 5; ++i ) {
            if (amounts[i] > 0) {
                stakedAssets[idx] = getTokenSymbol(i);
                stakedAmounts[idx++] = amounts[i];
            }
        }

        IBalancerV2Vault(BALANCER_VAULT_ADDRESS).joinPool(poolId, address(this), address(this), request);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(symbol, pool);
        for (uint256 i; i < request.assets.length; ++i ) {
            IERC20Metadata token = IERC20Metadata(assets[i]);
            if (token.balanceOf(address(this)) == 0) {
                DiamondStorageLib.removeOwnedAsset(token.symbol());
            }
        }

        emit Staked(
            msg.sender,
            stakedAssets,
            balancerTokenAddress,
            stakedAmounts,
            balancerToken.balanceOf(address(this)) - initialBalancerBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes tokens from Balancer BalancerVaultName pool
     * @param amount amount of token to be unstaked
     **/
    function unstakeAndExitPool(bytes32 poolId, ExitPoolRequest memory request) external nonReentrant onlyOwnerOrInsolvent recalculateAssetsExposure {
        IBalancerV2Vault pool = IBalancerV2Vault(BALANCER_VAULT_ADDRESS);
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();
        address balancerTokenAddress = tokenManager.getAssetAddress(BALANCER_TOKEN_SYMBOL, true);
        IERC20 balancerToken = IERC20(balancerTokenAddress);
        uint256 balancerTokenBalance = balancerToken.balanceOf(address(this));
        uint256[request.assets.length] memory initialDepositTokenBalances;

        for (uint256 i; i < request.assets.length; ++i) {
            IERC20 depositToken = IERC20Metadata(request.assets[i]);
            initialDepositTokenBalances[i] = depositToken.balanceOf(address(this));
        }
        amount = Math.min(balancerTokenBalance, amount);

        balancerTokenAddress.safeApprove(BALANCER_VAULT_ADDRESS, 0);
        balancerTokenAddress.safeApprove(BALANCER_VAULT_ADDRESS, amount);
        IBalancerV2Vault(BALANCER_VAULT_ADDRESS).exitPool(poolId, address(this), address(this), request);

        // Add/remove owned tokens
        for (uint256 i; i < request.assets.length; ++i) {
            IERC20 depositToken = IERC20(tokenManager.getAssetAddress(getTokenSymbol(i), true));
            unstakedAmounts[i] = depositToken.balanceOf(address(this)) - initialDepositTokenBalances[i];
            DiamondStorageLib.addOwnedAsset(getTokenSymbol(i), address(depositToken));
        }
        uint256 newBalancerTokenBalance = balancerToken.balanceOf(address(this));
        if(newBalancerTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(BALANCER_TOKEN_SYMBOL);
        }

        emit Unstaked(
            msg.sender,
            getTokenSymbols(),
            balancerTokenAddress,
            unstakedAmounts,
            balancerTokenBalance - newBalancerTokenBalance,
            block.timestamp
        );
    }

    // INTERNAL FUNCTIONS

    function poolToRedstoneSymbol(address pool) internal pure returns (bytes32 symbol) {
        if (pool == "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22") {
            symbol = "BAL_sAVAX_WAVAX_BPT";
        }

        revert BalancerV2PoolNotWhitelisted();
    }


    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }


    // ERRORS
    error BalancerV2PoolNotWhitelisted();

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
