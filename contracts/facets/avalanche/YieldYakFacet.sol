// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "../../lib/SolvencyMethods.sol";
import "../SolvencyFacet.sol";
import "../../interfaces/facets/avalanche/IYakStakingAVAXAAVEV1.sol";
import "../../interfaces/facets/avalanche/IYakStakingVectorSAV2.sol";

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IWrappedNativeToken.sol";

//This path is updated during deployment
import "../../lib/local/DeploymentConstants.sol";

contract YieldYakFacet is ReentrancyGuardKeccak, SolvencyMethods {
    using TransferHelper for address payable;
    using TransferHelper for address;

    address private constant YAKStakingAVAXAAVEV1Address = 0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95;
    address private constant SAVAXAddress = 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE;
    address private constant YAKStakingVectorSAV2Address = 0xd0F41b1C9338eB9d374c83cC76b684ba3BB71557;

    // LPs
    address private constant YY_TJ_AVAX_USDC = 0xDEf94a13fF31FB6363f1e03bF18fe0F59Db83BBC;
    address private constant TJ_AVAX_USDC_ADDRESS = 0xf4003F4efBE8691B60249E6afbD307aBE7758adb;

    // TODO: Change name to a more unique one for this exact investment strategy
    /**
        * Stakes AVAX in Yield Yak protocol
        * @dev This function uses the redstone-evm-connector
        * @param amount amount of AVAX to be staked
    **/
    function stakeAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        require(amount > 0, "Cannot stake 0 tokens");
        require(IWrappedNativeToken(DeploymentConstants.getNativeToken()).balanceOf(address(this)) >= amount, "Not enough AVAX available");

        IWrappedNativeToken(DeploymentConstants.getNativeToken()).withdraw(amount);
        IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address).deposit{value: amount}();

        // TODO make staking more generic
        // Add asset to ownedAssets
        DiamondStorageLib.addOwnedAsset("YYAV3SA1", YAKStakingAVAXAAVEV1Address);

        emit Staked(msg.sender, "AVAX", amount, block.timestamp);
    }

    /**
       * Stakes SAVAX in Yield Yak protocol
       * @dev This function uses the redstone-evm-connector
       * @param amount amount of SAVAX to be staked
   **/
    function stakeSAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        require(amount > 0, "Cannot stake 0 tokens");
        require(IERC20Metadata(SAVAXAddress).balanceOf(address(this)) >= amount, "Not enough SAVAX available");

        IERC20Metadata(SAVAXAddress).approve(address(YAKStakingVectorSAV2Address), amount);
        // TODO: Change the name of interface
        IYakStakingVectorSAV2(YAKStakingVectorSAV2Address).deposit(amount);

        // TODO make staking more generic
        // Add asset to ownedAssets
        DiamondStorageLib.addOwnedAsset("$YYVSAVAXV2", YAKStakingVectorSAV2Address);

        emit Staked(msg.sender, "SAVAX", amount, block.timestamp);
    }

    /**
      * Stakes TJ_AVAX_USDC in Yield Yak protocol
      * @dev This function uses the redstone-evm-connector
      * @param amount amount of TJ_AVAX_USDC to be staked
  **/
    function stakeTJAVAXUSDCYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        require(amount > 0, "Cannot stake 0 tokens");
        require(IERC20Metadata(TJ_AVAX_USDC_ADDRESS).balanceOf(address(this)) >= amount, "Not enough TJ_AVAX_USDC available");

        IERC20Metadata(TJ_AVAX_USDC_ADDRESS).approve(address(YY_TJ_AVAX_USDC), amount);

        // TODO: Change the name of interface
        IYakStakingVectorSAV2(YY_TJ_AVAX_USDC).deposit(amount);

        // TODO make staking more generic
        // Add asset to ownedAssets
        DiamondStorageLib.addOwnedAsset("YY_TJ_AVAX_USDC", YY_TJ_AVAX_USDC);

        emit Staked(msg.sender, "TJ_AVAX_USDC", amount, block.timestamp);
    }


    function unstakeTJAVAXUSDCYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        IYakStakingVectorSAV2 yakStakingContract = IYakStakingVectorSAV2(YY_TJ_AVAX_USDC);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        yakStakingContract.withdraw(amount);

        // TODO make unstaking more generic
        if(yakStakingContract.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("$YYVSAVAXV2");
        }

        emit Unstaked(msg.sender, "SAVAX", amount, block.timestamp);
    }


    function unstakeSAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        IYakStakingVectorSAV2 yakStakingContract = IYakStakingVectorSAV2(YAKStakingVectorSAV2Address);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        yakStakingContract.withdraw(amount);

        // TODO make unstaking more generic
        if(yakStakingContract.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("$YYVSAVAXV2");
        }

        emit Unstaked(msg.sender, "SAVAX", amount, block.timestamp);
    }


    // TODO: Change name to a more unique one for this exact investment strategy
    /**
    * Unstakes AVAX from Yield Yak protocol
    * @dev This function uses the redstone-evm-connector
    * @param amount amount of AVAX to be unstaked
    **/
    function unstakeAVAXYak(uint256 amount) public onlyOwner nonReentrant remainsSolvent {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        yakStakingContract.withdraw(amount);

        // TODO make unstaking more generic
        if(yakStakingContract.balanceOf(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset("YYAV3SA1");
        }

        emit Unstaked(msg.sender, "AVAX", amount, block.timestamp);

        IWrappedNativeToken(DeploymentConstants.getNativeToken()).deposit{value: amount}();
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
        * @param asset the asset that was staked
        * @param amount of the asset that was staked
        * @param timestamp of staking
    **/
    event Staked(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);

    /**
        * @dev emitted when user unstakes an asset
        * @param user the address executing unstaking
        * @param asset the asset that was unstaked
        * @param amount of the asset that was unstaked
        * @param timestamp of unstaking
    **/
    event Unstaked(address indexed user, bytes32 indexed asset, uint256 amount, uint256 timestamp);
}