// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../../ReentrancyGuardKeccak.sol";
import "../../lib/SolvencyMethodsLib.sol";
import "../../interfaces/IVectorFinanceStaking.sol";
import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";
import "../../interfaces/IStakingPositions.sol";
import "../../OnlyOwnerOrInsolvent.sol";

contract VectorFinanceFacet is ReentrancyGuardKeccak, SolvencyMethodsLib, OnlyOwnerOrInsolvent {

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
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "USDC",
            balanceSelector: this.vectorUSDC1Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC1.selector
        });
        stakeToken("VUSDC1", "USDC", USDCAddress, VectorUSDCStaking1, amount, position);
    }

    function vectorUnstakeUSDC1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "USDC",
            balanceSelector: this.vectorUSDC1Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC1.selector
        });
        unstakeToken("VUSDC1", "USDC", USDCAddress, VectorUSDCStaking1, amount, minAmount, position);
    }

    function vectorUSDC1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(VectorUSDCStaking1);
        _stakedBalance = stakingContract.balance(address(this));
    }

    function vectorStakeUSDC2(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "USDC",
            balanceSelector: this.vectorUSDC2Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC2.selector
        });
        stakeToken("VUSDC2", "USDC", USDCAddress, VectorUSDCStaking2, amount, position);
    }

    function vectorUnstakeUSDC2(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "USDC",
            balanceSelector: this.vectorUSDC2Balance.selector,
            unstakeSelector: this.vectorUnstakeUSDC2.selector
        });
        unstakeToken("VUSDC2", "USDC", USDCAddress, VectorUSDCStaking2, amount, minAmount, position);
    }

    function vectorUSDC2Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(VectorUSDCStaking2);
        _stakedBalance = stakingContract.balance(address(this));
    }

    function vectorStakeWAVAX1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "AVAX",
            balanceSelector: this.vectorWAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeWAVAX1.selector
        });
        stakeToken("VWAVAX1", "AVAX", WAVAXAddress, VectorWAVAXStaking1, amount, position);
    }

    function vectorUnstakeWAVAX1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "AVAX",
            balanceSelector: this.vectorWAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeWAVAX1.selector
        });
        unstakeToken("VWAVAX1", "AVAX", WAVAXAddress, VectorWAVAXStaking1, amount, minAmount, position);
    }

    function vectorWAVAX1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(VectorWAVAXStaking1);
        _stakedBalance = stakingContract.balance(address(this));
    }

    function vectorStakeSAVAX1(uint256 amount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "sAVAX",
            balanceSelector: this.vectorSAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeSAVAX1.selector
        });
        stakeToken("VSAVAX1", "sAVAX", SAVAXAddress, VectorSAVAXStaking1, amount, position);
    }

    function vectorUnstakeSAVAX1(uint256 amount, uint256 minAmount) public {
        IStakingPositions.StakedPosition memory position = IStakingPositions.StakedPosition({
            symbol: "sAVAX",
            balanceSelector: this.vectorSAVAX1Balance.selector,
            unstakeSelector: this.vectorUnstakeSAVAX1.selector
        });
        unstakeToken("VSAVAX1", "sAVAX", SAVAXAddress, VectorSAVAXStaking1, amount, minAmount, position);
    }

    function vectorSAVAX1Balance() public view returns(uint256 _stakedBalance) {
        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(VectorSAVAXStaking1);
        _stakedBalance = stakingContract.balance(address(this));
    }

    // INTERNAL FUNCTIONS

    function stakeToken(bytes32 receiptTokenSymbol, bytes32 stakedTokenSymbol, address stakedToken, address receiptToken, uint256 amount, IStakingPositions.StakedPosition memory position) internal
    onlyOwner nonReentrant remainsSolvent {
        require(amount > 0, "Cannot stake 0 tokens");
        require(IERC20Metadata(stakedToken).balanceOf(address(this)) >= amount, "Not enough token available");

        IERC20Metadata(stakedToken).approve(VectorMainStaking, amount);

        IVectorFinanceStaking(receiptToken).deposit(amount);

        DiamondStorageLib.addStakedPosition(position);

        emit Staked(msg.sender, stakedTokenSymbol, amount, block.timestamp);
    }

    function unstakeToken(bytes32 receiptTokenSymbol, bytes32 stakedTokenSymbol, address stakedToken, address receiptToken, uint256 amount, uint256 minAmount, IStakingPositions.StakedPosition memory position) internal
    onlyOwnerOrInsolvent nonReentrant returns (uint256 unstaked) {

        IVectorFinanceStaking stakingContract = IVectorFinanceStaking(receiptToken);
        uint256 initialStakedBalance = stakingContract.balance(address(this));

        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");

        IERC20Metadata token = getERC20TokenInstance(stakedTokenSymbol, true);

        uint256 balance = token.balanceOf(address(this));

        stakingContract.withdraw(amount, minAmount);

        uint256 newBalance = token.balanceOf(address(this));

        if (stakingContract.balance(address(this)) == 0) {
            DiamondStorageLib.removeStakedPosition(position);
        }

        if (newBalance == 0) {
            DiamondStorageLib.removeOwnedAsset(receiptTokenSymbol);
        }

        emit Unstaked(msg.sender, stakedTokenSymbol, newBalance - balance, block.timestamp);

        return newBalance - balance;
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