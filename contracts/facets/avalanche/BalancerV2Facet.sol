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

contract BalancerV2Facet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    using TransferHelper for address;

    // Used to deposit/withdraw tokens
    address private constant VAULT_ADDRESS = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    /**
     * Joins a pool and stakes in a gauge
     * @param poolId id of a balancer pool
     * @param request Balancer request for joining a pool
     **/
    function joinPoolAndStakeBalancerV2(bytes32 poolId, bytes32 stakedToken, IVault.JoinPoolRequest memory request) external nonReentrant onlyOwner recalculateAssetsExposure remainsSolvent {
        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        IVault vault = IVault(VAULT_ADDRESS);

        (address pool,) = vault.getPool(poolId);

        bool allZero = true;

        uint256[] memory initialDepositTokenBalances = new uint256[](request.assets.length);

        for (uint256 i; i < request.assets.length; ++i) {
            IERC20 depositToken = IERC20Metadata(address(request.assets[i]));
            initialDepositTokenBalances[i] = depositToken.balanceOf(address(this));
        }

        for (uint256 i; i < request.maxAmountsIn.length; ++i ) {
            if (request.maxAmountsIn[i] > 0) {
                allZero = false;
                address(request.assets[i]).safeApprove(VAULT_ADDRESS, 0);
                address(request.assets[i]).safeApprove(VAULT_ADDRESS, request.maxAmountsIn[i]);
            }
        }
        require(!allZero, "Cannot joinPoolAndStakeBalancerV2 0 tokens");

        bytes32[] memory stakedAssets = new bytes32[](request.assets.length);
        uint256[] memory stakedAmounts = new uint256[](request.assets.length);

        for (uint256 i; i < request.assets.length; ++i ) {
            IERC20 depositToken = IERC20Metadata(address(request.assets[i]));
            stakedAssets[i] = tokenManager.tokenAddressToSymbol(address(request.assets[i]));
            stakedAmounts[i] = depositToken.balanceOf(address(this)) - initialDepositTokenBalances[i];
        }

        //joins the pools
        IVault(VAULT_ADDRESS).joinPool(poolId, address(this), address(this), request);

        //poolToGauge checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));

        IERC20(pool).approve(address(gauge), IERC20(pool).balanceOf(address(this)));
        //stakes everything in a gauge
        gauge.deposit(IERC20(pool).balanceOf(address(this)));

        // Add pool token
        DiamondStorageLib.addOwnedAsset(tokenManager.tokenAddressToSymbol(address(gauge)), address(gauge));

        // Remove deposit tokens if empty
        for (uint256 i; i < request.assets.length; ++i ) {
            if (address(request.assets[i]) != pool) {
                IERC20Metadata token = IERC20Metadata(address(request.assets[i]));
                if (token.balanceOf(address(this)) == 0) {
                    DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(address(token)));
                }
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
     * @param poolId id of a balancer pool
     * @param request Balancer request for exiting pool
    **/
    function unstakeAndExitPoolBalancerV2(bytes32 poolId, IVault.ExitPoolRequest memory request) external nonReentrant onlyOwnerOrInsolvent recalculateAssetsExposure {
        uint256[] memory unstakedAmounts = new uint256[](request.assets.length);

        IVault vault = IVault(VAULT_ADDRESS);

        (address pool,) = vault.getPool(poolId);

        ITokenManager tokenManager = DeploymentConstants.getTokenManager();

        uint256[] memory initialDepositTokenBalances = new uint256[](request.assets.length);

        for (uint256 i; i < request.assets.length; ++i) {
            IERC20 depositToken = IERC20Metadata(address(request.assets[i]));
            initialDepositTokenBalances[i] = depositToken.balanceOf(address(this));
        }

        //checks as well if the pool is whitelisted
        IBalancerV2Gauge gauge = IBalancerV2Gauge(poolToGauge(pool));

        uint256 initialGaugeBalance = IERC20(gauge).balanceOf(address(this));

        //unstakes from the gauge
        gauge.withdraw(gauge.balanceOf(address(this)));

        //exit pool to basic assets
        IVault(VAULT_ADDRESS).exitPool(poolId, address(this), payable(address(this)), request);

        bytes32[] memory unstakedAssets = new bytes32[](request.assets.length);

        // Add/remove owned tokens
        for (uint256 i; i < request.assets.length; ++i) {
            //request.assets can contain the pool token, we skip it here
            if (address(request.assets[i]) != pool) {
                IERC20 depositToken = IERC20(address(request.assets[i]));
                unstakedAssets[i] = tokenManager.tokenAddressToSymbol(address(request.assets[i]));
                unstakedAmounts[i] = depositToken.balanceOf(address(this)) - initialDepositTokenBalances[i];

                if (unstakedAssets[i] != "") {
                    DiamondStorageLib.addOwnedAsset(unstakedAssets[i], address(depositToken));
                }
            }
        }

        console.log('newGaugeBalance: ', newGaugeBalance);

        uint256 newGaugeBalance = IERC20(gauge).balanceOf(address(this));

        console.log('newGaugeBalance: ', newGaugeBalance);

        if (newGaugeBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(tokenManager.tokenAddressToSymbol(address(gauge)));
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

    //Balancer pools can consists of various tokens, some unsupported by DeltaPrime. That is why it is checked
    //whether a token that user wants deposits from/to is whitelisted
    function poolToAcceptedTokens(address pool) internal returns (bytes32[]) {
        if (pool == 0xA154009870E9B6431305F19b09F9cfD7284d4E7A) {
            return ['sAVAX'];
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
    event Unstaked(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

}
