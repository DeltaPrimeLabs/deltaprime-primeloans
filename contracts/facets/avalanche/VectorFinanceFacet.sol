// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "../../lib/SolvencyMethodsLib.sol";
import "../../interfaces/IVectorFinanceStaking.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

contract VectorFinanceFacet is ReentrancyGuardKeccak, SolvencyMethodsLib {

    // CONSTANTS

    address private constant VectorMainStaking = 0x8B3d9F0017FA369cD8C164D0Cc078bf4cA588aE5;

    address private constant USDCAddress = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    address private constant VectorUSDCStaking1 = 0x7550B2d6a1F039Dd6a3d54a857FEFCbF77213D80;
    address private constant VectorUSDCStaking2 = 0xDA9E515Ce714c4309f7C4483F4802556AE5Df396;

    address private constant WAVAXAddress = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address private constant VectorWAVAXStaking1 = 0xff5386aF93cF4bD8d5AeCad6df7F4f4be381fD69;

    address private constant SAVAXAddress = 0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE;
    address private constant VectorSAVAXStaking1 = 0x812b7C3b5a9164270Dd8a0b3bc47550877AECdB1;

    // PUBLIC FUNCTIONS

    function vectorStakeUSDC1(uint256 amount) public {
        stakeToken("VUSDC1", "USDC", USDCAddress, VectorUSDCStaking1, amount);
    }

    function vectorUnstakeUSDC1(uint256 amount) public {
        unstakeToken("VUSDC1", "USDC", USDCAddress, VectorUSDCStaking1, amount);
    }

    function vectorStakeUSDC2(uint256 amount) public {
        stakeToken("VUSDC2", "USDC", USDCAddress, VectorUSDCStaking2, amount);
    }

    function vectorUnstakeUSDC2(uint256 amount) public {
        unstakeToken("VUSDC2", "USDC", USDCAddress, VectorUSDCStaking2, amount);
    }

    function vectorStakeWAVAX1(uint256 amount) public {
        stakeToken("VWAVAX1", "WAVAX", WAVAXAddress, VectorWAVAXStaking1, amount);
    }

    function vectorUnstakeWAVAX1(uint256 amount) public {
        unstakeToken("VWAVAX1", "WAVAX", WAVAXAddress, VectorWAVAXStaking1, amount);
    }

    function vectorStakeSAVAX1(uint256 amount) public {
        stakeToken("VSAVAX1", "SAVAX", SAVAXAddress, VectorSAVAXStaking1, amount);
    }

    function vectorUnstakeSAVAX1(uint256 amount) public {
        unstakeToken("VSAVAX1", "SAVAX", SAVAXAddress, VectorSAVAXStaking1, amount);
    }

    // INTERNAL FUNCTIONS

    function stakeToken(bytes32 receiptTokenSymbol, bytes32 stakedTokenSymbol, address stakedToken, address receiptToken, uint256 amount) internal
    onlyOwner nonReentrant remainsSolvent {
        require(amount > 0, "Cannot stake 0 tokens");
        require(IERC20Metadata(stakedToken).balanceOf(address(this)) >= amount, "Not enough AVAX available");

        IERC20Metadata(stakedToken).approve(VectorMainStaking, amount);

        IVectorFinanceStaking(receiptToken).deposit(amount);

        // Add asset to ownedAssets
        DiamondStorageLib.addOwnedAsset(receiptTokenSymbol, receiptToken);

        emit Staked(msg.sender, stakedTokenSymbol, amount, block.timestamp);
    }

    function unstakeToken(bytes32 receiptTokenSymbol, bytes32 stakedTokenSymbol, address stakedToken, address receiptToken, uint256 amount) internal
    onlyOwner nonReentrant remainsSolvent {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(receiptToken);
        uint256 initialStakedBalance = stakingContract.balance(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        // Max 1% allowed fees
        stakingContract.withdraw(amount, amount * 99 / 100);

        if (stakingContract.balance(address(this)) == 0) {
            DiamondStorageLib.removeOwnedAsset(receiptTokenSymbol);
        }

        emit Unstaked(msg.sender, stakedTokenSymbol, amount, block.timestamp);
    }

    // MODIFIERS

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }

    // EVENTS

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