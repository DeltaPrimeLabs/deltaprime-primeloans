// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 1dd71dbe7e446d0f8ed0811a3d4e3363606688f2;
pragma solidity ^0.8.4;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IYakStakingAVAXAAVEV1.sol";
import "hardhat/console.sol";
import "../interfaces/IYieldYakRouter.sol";

contract YieldYakRouter is IYieldYakRouter, ReentrancyGuard {
    using TransferHelper for address payable;
    using TransferHelper for address;

    address private constant YAKStakingAVAXAAVEV1Address = 0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95;

    function stakeAVAX(uint256 amount) public payable override nonReentrant{
        IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address).depositFor{value: amount}(msg.sender);
    
        emit Staked(msg.sender, "AVAX", amount, block.timestamp);
    }

    function unstakeAVAX(uint256 amount) public override nonReentrant returns(bool) {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(msg.sender);
        uint256 allowanceForRouter = yakStakingContract.allowance(msg.sender, address(this));
        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");
        require(allowanceForRouter >= amount, "Insufficient allowance for the router contract");

        address(yakStakingContract).safeTransferFrom(msg.sender, address(this), amount);
        (bool success, ) = address(yakStakingContract).call(abi.encodeWithSignature("withdraw(uint256)", amount));
        if (!success) {
            address(yakStakingContract).safeTransfer(msg.sender, amount);
            return false;
        }
        payable(msg.sender).safeTransferETH(address(this).balance);

        emit Unstaked(msg.sender, "AVAX", amount, block.timestamp);
        return true;
    }

    function getTotalStakedValue() public view override returns (uint256 totalValue) {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 stakedBalance = yakStakingContract.balanceOf(msg.sender);
        if (stakedBalance == 0) {
            totalValue = 0;
        } else {
            uint256 totalSupply = yakStakingContract.totalSupply();
            uint256 totalDeposits = yakStakingContract.totalDeposits();
            totalValue = stakedBalance * totalDeposits / totalSupply;
        }
    }

    function unstakeAVAXForASpecifiedAmount(uint256 amount) public override {
        IYakStakingAVAXAAVEV1 yakStakingContract = IYakStakingAVAXAAVEV1(YAKStakingAVAXAAVEV1Address);
        uint256 stakedBalance = yakStakingContract.balanceOf(msg.sender);

        if (stakedBalance != 0) {
            uint256 totalSupply = yakStakingContract.totalSupply();
            uint256 totalDeposits = yakStakingContract.totalDeposits();
            uint256 totalStakedValue = stakedBalance * totalDeposits / totalSupply;
            if (totalStakedValue < amount) {
                unstakeAVAX(stakedBalance);
            } else {
                uint256 unstakeAmount = amount * stakedBalance / totalStakedValue;
                unstakeAVAX(unstakeAmount);
            }
        }
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
