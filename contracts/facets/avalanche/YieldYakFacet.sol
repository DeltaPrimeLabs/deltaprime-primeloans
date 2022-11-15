// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "../../lib/SolvencyMethods.sol";
import "../../interfaces/facets/avalanche/IYieldYak.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IWrappedNativeToken.sol";

// TODO: Check STATUS (tokenManager) of Vault tokens before allowing to stake
//This path is updated during deployment
import "../../lib/avalanche/DeploymentConstants.sol";

contract YieldYakFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;

    // Staking Vaults tokens
    address private constant YY_AVAX_AAVE = 0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95; // @dev: RedStone token name: YYAV3SA1
    address private constant YY_SAVAX_VECTOR = 0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557; //  @dev: RedStone token name: SAV2

    // Staking Vaults LPs
    address private constant YY_TJ_USDC_WAVAX_LP = 0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC;

    // Tokens
    address private constant SAVAX_TOKEN = 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE;
    address private constant AVAX_TOKEN = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    // LPs
    address private constant TJ_WAVAX_USDC_LP = 0xf4003F4efBE8691B60249E6afbD307aBE7758adb;

    // ----- STAKE -----

    /**
        * Stakes AVAX in Yield Yak protocol
        * @dev This function uses the redstone-evm-connector
        * @param amount amount of AVAX to be staked
    **/
    function stakeAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        require(amount > 0, "Cannot stake 0 tokens");
        require(IWrappedNativeToken(AVAX_TOKEN).balanceOf(address(this)) >= amount, "Not enough AVAX available");

        IWrappedNativeToken(AVAX_TOKEN).withdraw(amount);
        IYieldYak(YY_AVAX_AAVE).deposit{value: amount}();

        DiamondStorageLib.addOwnedAsset("YYAV3SA1", YY_AVAX_AAVE);

        emit Staked(msg.sender, "AVAX", YY_AVAX_AAVE, amount, block.timestamp);
    }

    /**
       * Stakes sAVAX in Yield Yak protocol
       * @dev This function uses the redstone-evm-connector
       * @param amount amount of sAVAX to be staked
   **/
    function stakeSAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        _stakeTokenYY(IYieldYak.YYStakingDetails({
            tokenAddress: SAVAX_TOKEN,
            vaultAddress: YY_SAVAX_VECTOR,
            tokenSymbol: "sAVAX",
            vaultTokenSymbol: "SAV2",
            amount: amount
        }));
    }

    /**
      * Stakes TJ_AVAX_USDC in Yield Yak protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of TJ_AVAX_USDC to be staked
  **/
    function stakeTJAVAXUSDCYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        _stakeTokenYY(IYieldYak.YYStakingDetails({
            tokenAddress: TJ_WAVAX_USDC_LP,
            vaultAddress: YY_TJ_USDC_WAVAX_LP,
            tokenSymbol: "TJ_WAVAX_USDC_LP",
            vaultTokenSymbol: "YY_TJ_USDC_WAVAX_LP",
            amount: amount
        }));
    }

    // ----- UNSTAKE -----

    /**
        * Unstakes AVAX from Yield Yak protocol
        * @dev This function uses the redstone-evm-connector
        * @param amount amount of AVAX to be unstaked
        **/
    function unstakeAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        IYieldYak yakStakingContract = IYieldYak(YY_AVAX_AAVE);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        yakStakingContract.withdraw(amount);

        if(yakStakingContract.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("YYAV3SA1");
        }

        emit Unstaked(msg.sender, "AVAX", YY_AVAX_AAVE, amount, block.timestamp);

        IWrappedNativeToken(AVAX_TOKEN).deposit{value: amount}();
    }

    function unstakeSAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        _unstakeTokenYY(IYieldYak.YYStakingDetails({
            tokenAddress: SAVAX_TOKEN,
            vaultAddress: YY_SAVAX_VECTOR,
            tokenSymbol: "sAVAX",
            vaultTokenSymbol: "SAV2",
            amount: amount
        }));
    }

    function unstakeTJAVAXUSDCYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        _unstakeTokenYY(IYieldYak.YYStakingDetails({
            tokenAddress: TJ_WAVAX_USDC_LP,
            vaultAddress: YY_TJ_USDC_WAVAX_LP,
            tokenSymbol: "TJ_WAVAX_USDC_LP",
            vaultTokenSymbol: "YY_TJ_USDC_WAVAX_LP",
            amount: amount
        }));
    }

    // ----- PRIVATE METHODS -----

    /**
      * Stakes {stakingDetails.tokenAddress} token in the YieldYak protocol
      * @dev This function uses the redstone-evm-connector
      * @param stakingDetails IYieldYak.YYStakingDetails staking details
    **/
    function _stakeTokenYY(IYieldYak.YYStakingDetails memory stakingDetails) private {
        TokenManager tokenManager = DeploymentConstants.getTokenManager();

        require(stakingDetails.amount > 0, "Cannot stake 0 tokens");
        // _ACTIVE = 2
        require(tokenManager.tokenToStatus(stakingDetails.tokenAddress) == 2, "Token not supported");
        require(tokenManager.tokenToStatus(stakingDetails.vaultAddress) == 2, "Vault token not supported");
        require(IERC20Metadata(stakingDetails.tokenAddress).balanceOf(address(this)) >= stakingDetails.amount, "Not enough token available");

        IERC20Metadata(stakingDetails.tokenAddress).approve(stakingDetails.vaultAddress, stakingDetails.amount);
        IYieldYak(stakingDetails.vaultAddress).deposit(stakingDetails.amount);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(stakingDetails.vaultTokenSymbol, stakingDetails.vaultAddress);
        if(IERC20(stakingDetails.tokenAddress).balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.tokenSymbol);
        }

        emit Staked(msg.sender, stakingDetails.tokenSymbol, stakingDetails.vaultAddress, stakingDetails.amount, block.timestamp);
    }

    /**
      * Unstakes {stakingDetails.tokenAddress} token in the YieldYak protocol
      * @dev This function uses the redstone-evm-connector
      * @param stakingDetails IYieldYak.YYStakingDetails staking details
    **/
    function _unstakeTokenYY(IYieldYak.YYStakingDetails memory stakingDetails) private {
        IYieldYak vaultContract = IYieldYak(stakingDetails.vaultAddress);
        uint256 initialStakedBalance = vaultContract.balanceOf(address(this));

        require(initialStakedBalance >= stakingDetails.amount, "Cannot unstake more than was initially staked");

        vaultContract.withdraw(stakingDetails.amount);

        // Add/remove owned tokens
        DiamondStorageLib.addOwnedAsset(stakingDetails.tokenSymbol, stakingDetails.tokenAddress);
        if(vaultContract.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(stakingDetails.vaultTokenSymbol);
        }

        emit Unstaked(msg.sender, stakingDetails.tokenSymbol, stakingDetails.vaultAddress, stakingDetails.amount, block.timestamp);
    }


    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    /* ========== RECEIVE AVAX FUNCTION ========== */
    receive() external payable {}

    /**
        * @dev emitted when user stakes an asset
        * @param user the address executing staking
        * @param vault address of the vault token
        * @param asset the asset that was staked
        * @param amount of the asset that was staked
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param vault address of the vault token
        * @param asset the asset that was unstaked
        * @param amount of the asset that was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, address indexed vault, uint256 amount, uint256 timestamp);
}