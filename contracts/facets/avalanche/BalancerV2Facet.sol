// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 799a1765b64edc5c158198ef84f785af79e234ae;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/balancer-v2/IBalancerV2Vault.sol";
import "../../interfaces/balancer-v2/IBalancerV2Gauge.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";
import "../../interfaces/balancer-v2/IBalancerV2Vault.sol";

import "../../interfaces/facets/avalanche/IBalancerV2Facet.sol";

contract BalancerV2Facet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // Used to deposit/withdraw tokens
    address private constant VAULT_ADDRESS = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    /**
     * Joins a pool and stakes in a gauge
     * @param request stake request
     **/
    function joinPoolAndStakeBalancerV2(IBalancerV2Facet.StakeRequest memory request) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        if (request.stakedTokens.length != request.stakedAmounts.length) revert ArgArrayLengthsDiffer();

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        IVault vault = IVault(VAULT_ADDRESS);

        (address pool,) = vault.getPool(request.poolId);

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        for (uint256 i; i < request.stakedTokens.length; i++) {
            if (request.stakedAmounts[i] > 0 && !tokenManager.isTokenAssetActive(request.stakedTokens[i])) revert DepositingInactiveToken();
            if (request.stakedTokens[i] == address(pool) || request.stakedTokens[i] == address(gauge)) revert DepositingWrongToken();
        }

        bool allZero = true;

        uint256[] memory initialDepositTokenBalances = new uint256[](request.stakedAmounts.length);

        for (uint256 i; i < request.stakedTokens.length; ++i) {
            if (tokenManager.isTokenAssetActive(request.stakedTokens[i]) && request.stakedAmounts[i] > 0) {
                IERC20 depositToken = IERC20Metadata(request.stakedTokens[i]);
                initialDepositTokenBalances[i] = depositToken.balanceOf(address(this));
            }
        }

        for (uint256 i; i < request.stakedAmounts.length; ++i ) {
            if (request.stakedAmounts[i] > 0) {
                allZero = false;
                request.stakedTokens[i].safeApprove(VAULT_ADDRESS, 0);
                request.stakedTokens[i].safeApprove(VAULT_ADDRESS, request.stakedAmounts[i]);
            }
        }
        require(!allZero, "Cannot joinPoolAndStakeBalancerV2 0 tokens");

        {
            IAsset[] memory tokens = new IAsset[](request.stakedTokens.length + 1);
            uint256[] memory amounts = new uint256[](request.stakedAmounts.length + 1);

            for (uint256 i; i < tokens.length - 1; i++) {
                tokens[i] = IAsset(request.stakedTokens[i]);
                amounts[i] = request.stakedAmounts[i];
            }

            tokens[tokens.length - 1] = IAsset(pool);
            amounts[amounts.length - 1] = 0;

            IVault.JoinPoolRequest memory joinRequest = IVault.JoinPoolRequest(
                tokens,
                amounts,
                //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html
                abi.encode(1, request.stakedAmounts, request.minBptAmount),
                false
            );

            //joins the pools
            IVault(VAULT_ADDRESS).joinPool(request.poolId, address(this), address(this), joinRequest);
        }



        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));

        IERC20(pool).approve(address(gauge), IERC20(pool).balanceOf(address(this)));
        //stakes everything in a gauge
        gauge.deposit(IERC20(pool).balanceOf(address(this)));

        // Add pool token
        DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(address(gauge)), address(gauge));

        bytes32[] memory stakedAssets = new bytes32[](request.stakedTokens.length);
        uint256[] memory stakedAmounts = new uint256[](request.stakedAmounts.length);

        // Remove deposit tokens if empty and prepare arrays for the event
        for (uint256 i; i < request.stakedTokens.length; ++i ) {
            if (tokenManager.isTokenAssetActive(request.stakedTokens[i])) {
                IERC20Metadata token = IERC20Metadata(request.stakedTokens[i]);

                if (token.balanceOf(address(this)) == 0) {
                    DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(address(token)));
                }

                stakedAssets[i] = tokenManager.tokenAddressToSymbol(request.stakedTokens[i]);
                stakedAmounts[i] = initialDepositTokenBalances[i] - token.balanceOf(address(this));
            }
        }

        emit Staked(
            msg.sender,
            stakedAssets,
            pool,
            stakedAmounts,
            IERC20(gauge).balanceOf(address(this)) - initialGaugeBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes tokens a gauge and exits a pool
     * @param request unstake request
    **/
    function unstakeAndExitPoolBalancerV2(IBalancerV2Facet.UnstakeRequest memory request) external nonReentrant onlyOwnerOrInsolvent recalculateAssetsExposure {
        (address pool,) = IVault(VAULT_ADDRESS).getPool(request.poolId);

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        if (!DeploymentConstants.getTokenManager().isTokenAssetActive(request.unstakedToken)) revert UnstakingToInactiveToken();
        if (request.unstakedToken == address(pool) || request.unstakedToken == address(gauge)) revert UnstakingWrongToken();

        uint256 initialDepositTokenBalance = IERC20(request.unstakedToken).balanceOf(address(this));

        //checks as well if the pool is whitelisted
        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));

        //unstakes from the gauge
        gauge.withdraw(request.bptAmount);

        IVault.ExitPoolRequest memory exitRequest;

        //exit pool to basic assets
        {
            IAsset[] memory assets;
            uint256[] memory amounts;

            uint256 unstakedIndex;
            {
                (IERC20[] memory tokens,,) = IVault(VAULT_ADDRESS).getPoolTokens(request.poolId);

                assets = new IAsset[](tokens.length);
                amounts = new uint256[](tokens.length);

                for (uint256 i; i < amounts.length; ++i) {
                    assets[i] = IAsset(address(tokens[i]));
                    if (address(tokens[i]) == request.unstakedToken) {
                        amounts[i] = request.unstakedAmount;
                        unstakedIndex = i;
                    }
                }
            }

            exitRequest = IVault.ExitPoolRequest(
                assets,
                amounts,
                //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html
                abi.encode(0, request.bptAmount, unstakedIndex),
                false
            );
        }

        //joins the pools
        IVault(VAULT_ADDRESS).exitPool(request.poolId, address(this), payable(address(this)), exitRequest);

        bytes32[] memory unstakedAssets = new bytes32[](1);
        uint256[] memory unstakedAmounts = new uint256[](1);

        unstakedAssets[0] = DeploymentConstants.getTokenManager().tokenAddressToSymbol(request.unstakedToken);
        unstakedAmounts[0] = IERC20(request.unstakedToken).balanceOf(address(this)) - initialDepositTokenBalance;
        DiamondStorageLib.addOwnedAsset(unstakedAssets[0], address(request.unstakedToken));

        uint256 newGaugeBalance = IERC20(gauge).balanceOf(address(this));

        if (newGaugeBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(DeploymentConstants.getTokenManager().tokenAddressToSymbol(address(gauge)));
        }

        emit Unstaked(
            msg.sender,
            unstakedAssets,
            pool,
            unstakedAmounts,
            initialGaugeBalance - newGaugeBalance,
            block.timestamp
        );
    }

    // INTERNAL FUNCTIONS

    function poolToGauge(address pool) internal returns (address) {
        if (pool == 0xA154009870E9B6431305F19b09F9cfD7284d4E7A) {
            return 0x301A121D1d0d72C4005B354854a842A55D23251f;
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

    error ArgArrayLengthsDiffer();

    error DepositingInactiveToken();

    error DepositingWrongToken();

    error UnstakingToInactiveToken();

    error UnstakingWrongToken();

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
    event Unstaked(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

}
