// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "../../ReentrancyGuardKeccak.sol";
import "../../OnlyOwnerOrInsolvent.sol";
import "../../interfaces/ITokenManager.sol";
import "../../interfaces/facets/avalanche/ISteakHutPool.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract SteakHutFinanceFacet is ReentrancyGuardKeccak, OnlyOwnerOrInsolvent {
    // Tokens
    address private constant AVAX_TOKEN = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address private constant USDC_TOKEN = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;

    // LPs
    address private constant SH_AVAX_USDC_LP = 0x668530302c6Ecc4eBe693ec877b79300AC72527C;

    /**
     * Stakes AVAX/USDC in SteakHut AVAX/USDC pool
     * @param amount0Desired amount of AVAX to be staked
     * @param amount1Desired amount of USDC to be staked
     * @param amount0Min minimum amount of AVAX to be staked
     * @param amount1Min minimum amount of USDC to be staked
     **/
    function stakeSteakHutAVAXUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external nonReentrant onlyOwner remainsSolvent {
        _stakeTokenSteakHut(ISteakHutPool.StakingDetails({
            token0Address: AVAX_TOKEN,
            token1Address: USDC_TOKEN,
            vaultAddress: SH_AVAX_USDC_LP,
            token0Symbol: "AVAX",
            token1Symbol: "USDC",
            vaultTokenSymbol: "SH_AVAX_USDC_LP",
            amount0Desired: amount0Desired,
            amount1Desired: amount1Desired,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    /**
     * Unstakes DAI.e from SteakHut AVAX/USDC pool
     * @param liquidity amount of shares to be unstaked
     * @param amount0Min minimum amount of AVAX to be unstaked
     * @param amount1Min minimum amount of USDC to be unstaked
     **/
    function unstakeSteakHutAVAXUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external nonReentrant onlyOwner remainsSolvent {
        _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails({
            token0Address: AVAX_TOKEN,
            token1Address: USDC_TOKEN,
            vaultAddress: SH_AVAX_USDC_LP,
            token0Symbol: "AVAX",
            token1Symbol: "USDC",
            vaultTokenSymbol: "SH_AVAX_USDC_LP",
            liquidity: liquidity,
            amount0Min: amount0Min,
            amount1Min: amount1Min
        }));
    }

    // ----- PRIVATE METHODS -----

    /**
     * Stakes {stakingDetails.token0Address}, {stakingDetails.token1Address} token in the SteakHut pool
     * @param stakingDetails ISteakHutPool.StakingDetails staking details
     **/
    function _stakeTokenSteakHut(ISteakHutPool.StakingDetails memory stakingDetails) private recalculateAssetsExposure {
        IERC20Metadata vaultToken = IERC20Metadata(stakingDetails.vaultAddress);
        uint256 initialVaultBalance = vaultToken.balanceOf(address(this));

        stakingDetails.amount0Desired = Math.min(IERC20Metadata(stakingDetails.token0Address).balanceOf(address(this)), stakingDetails.amount0Desired);
        stakingDetails.amount1Desired = Math.min(IERC20Metadata(stakingDetails.token1Address).balanceOf(address(this)), stakingDetails.amount1Desired);
        require(stakingDetails.amount0Desired > 0 && stakingDetails.amount1Desired > 0, "Cannot stake 0 tokens");

        IERC20Metadata(stakingDetails.token0Address).approve(stakingDetails.vaultAddress, stakingDetails.amount0Desired);
        IERC20Metadata(stakingDetails.token1Address).approve(stakingDetails.vaultAddress, stakingDetails.amount1Desired);
        (, uint256 amount0Actual, uint256 amount1Actual) = ISteakHutPool(stakingDetails.vaultAddress).deposit(stakingDetails.amount0Desired, stakingDetails.amount1Desired, stakingDetails.amount0Min, stakingDetails.amount1Min);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(stakingDetails.vaultTokenSymbol, stakingDetails.vaultAddress);
        if(IERC20(stakingDetails.token0Address).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.token0Symbol);
        }
        if(IERC20(stakingDetails.token1Address).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.token1Symbol);
        }

        emit Staked(
            msg.sender,
            stakingDetails.token0Symbol,
            stakingDetails.token1Symbol,
            stakingDetails.vaultAddress,
            amount0Actual,
            amount1Actual,
            vaultToken.balanceOf(address(this)) - initialVaultBalance,
            block.timestamp
        );
    }

    /**
     * Unstakes {UnstakingDetails.token0Address}, {UnstakingDetails.token1Address} token from the SteakHut pool
     * @param unstakingDetails ISteakHutPool.UnstakingDetails unstaking details
     **/
    function _unstakeTokenSteakHut(ISteakHutPool.UnstakingDetails memory unstakingDetails) private recalculateAssetsExposure {
        ISteakHutPool pool = ISteakHutPool(unstakingDetails.vaultAddress);
        IERC20Metadata vaultToken = IERC20Metadata(unstakingDetails.vaultAddress);
        IERC20Metadata depositToken0 = IERC20Metadata(unstakingDetails.token0Address);
        IERC20Metadata depositToken1 = IERC20Metadata(unstakingDetails.token1Address);
        uint256 initialDepositTokenBalance0 = depositToken0.balanceOf(address(this));
        uint256 initialDepositTokenBalance1 = depositToken1.balanceOf(address(this));
        uint256 vaultTokenBalance = vaultToken.balanceOf(address(this));
        unstakingDetails.liquidity = Math.min(vaultToken.balanceOf(address(this)), unstakingDetails.liquidity);

        pool.withdraw(unstakingDetails.liquidity);

        uint256 amount0Unstaked = depositToken0.balanceOf(address(this)) - initialDepositTokenBalance0;
        uint256 amount1Unstaked = depositToken1.balanceOf(address(this)) - initialDepositTokenBalance1;
        require(amount0Unstaked >= unstakingDetails.amount0Min && amount1Unstaked >= unstakingDetails.amount1Min, "Unstaked less tokens than expected");

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(unstakingDetails.token0Symbol, unstakingDetails.token0Address);
        DiamondStorageLib.addOwnedAsset(unstakingDetails.token1Symbol, unstakingDetails.token1Address);
        uint256 newVaultTokenBalance = vaultToken.balanceOf(address(this));
        if(newVaultTokenBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(unstakingDetails.vaultTokenSymbol);
        }

        emit Unstaked(
            msg.sender,
            unstakingDetails.token0Symbol,
            unstakingDetails.token1Symbol,
            unstakingDetails.vaultAddress,
            amount0Unstaked,
            amount1Unstaked,
            vaultTokenBalance - newVaultTokenBalance,
            block.timestamp
        );
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param asset0 the asset that was unstaked
        * @param asset1 the asset that was unstaked
        * @param vault address of the vault token
        * @param depositTokenAmount0 how much deposit token0 was received
        * @param depositTokenAmount1 how much deposit token1 was received
        * @param receiptTokenAmount how much of receipt token was received
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 asset0, bytes32 asset1, address indexed vault, uint256 depositTokenAmount0, uint256 depositTokenAmount1, uint256 receiptTokenAmount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param vault address of the vault token
        * @param asset0 the asset that was unstaked
        * @param asset1 the asset that was unstaked
        * @param depositTokenAmount0 how much deposit token0 was received
        * @param depositTokenAmount1 how much deposit token1 was received
        * @param receiptTokenAmount how much receipt token was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 asset0, bytes32 asset1, address indexed vault, uint256 depositTokenAmount0, uint256 depositTokenAmount1, uint256 receiptTokenAmount, uint256 timestamp);
}
