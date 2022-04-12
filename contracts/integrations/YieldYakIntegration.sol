// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;

import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../integrations/DPIntegration.sol";
import "../lib/Bytes32EnumerableMap.sol";
import "../interfaces/StakingToken.sol";
import "hardhat/console.sol";

contract YieldYakIntegration is OwnableUpgradeable, ReentrancyGuardUpgradeable, DPIntegration {
    using EnumerableMap for EnumerableMap.Bytes32ToAddressMap;
    using TransferHelper for address payable;
    using TransferHelper for address;

    bytes32 constant private integrationID = "YIELDYAKV1";

    address private constant avaxStakingContractAddress = 0x957Ca4a4aA7CDc866cf430bb140753F04e273bC0;

    function getIntegrationID() external override pure returns(bytes32) {
        return integrationID;
    }

    function initialize(Asset[] memory _swapSupportedAssets, Asset[] memory _stakingSupportedAssets, Asset[] memory _lpSupportedAssets) external initializer {
        _updateAssets(swapSupportedAssets, _swapSupportedAssets);
        _updateAssets(lpSupportedAssets, _lpSupportedAssets);
        _updateAssets(stakingSupportedAssets, _stakingSupportedAssets);

        __Ownable_init();
    }



    function stakeFor(bytes32 _asset, uint256 _amount, address _recipient) public override payable nonReentrant returns(bool result) {
        require(isActionSupported(supportedActions.STAKE, _asset), "Staking this asset is not allowed");
        result = false;
        if(_asset == bytes32("AVAX")) {
            result = stakeAVAX(_amount, _recipient);
        }
    }

    function unstake(bytes32 _asset, uint256 _amount) public override nonReentrant returns(bool result) {
        require(isActionSupported(supportedActions.UNSTAKE, _asset), "Unstaking this asset is not allowed");
        result = false;
        if(_asset == bytes32("AVAX")) {
            result = unstakeAVAX(_amount);
        }
    }

    function getStakingContract(bytes32 _asset) public view override returns (StakingToken) {
        return StakingToken(getStakingAssetAddress(_asset));
    }

    function getTotalStakedValue() public view override returns (uint256 totalValue) {
        StakingToken yakStakingContract = StakingToken(avaxStakingContractAddress);
        uint256 stakedBalance = yakStakingContract.balanceOf(msg.sender);
        if (stakedBalance == 0) {
            totalValue = 0;
        } else {
            uint256 totalSupply = yakStakingContract.totalSupply();
            uint256 totalDeposits = yakStakingContract.totalDeposits();
            totalValue = stakedBalance * totalDeposits / totalSupply;
        }
    }

    // INTEGRATION-SPECIFIC METHODS

    function stakeAVAX(uint256 amount, address _recipient) internal returns(bool) {
        StakingToken(avaxStakingContractAddress).depositFor{value: amount}(_recipient);

        emit Staked(_recipient, "AVAX", amount, block.timestamp);
        return true;
    }

    function unstakeAVAX(uint256 amount) internal nonReentrant returns(bool) {
        StakingToken yakStakingContract = StakingToken(avaxStakingContractAddress);
        uint256 initialStakedBalance = yakStakingContract.balanceOf(msg.sender);
        uint256 allowanceForIntegration = yakStakingContract.allowance(msg.sender, address(this));
        require(initialStakedBalance >= amount, "Cannot unstake more than was initially staked");
        require(allowanceForIntegration >= amount, "Insufficient allowance for the router contract");

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

    function unstakeAVAXForASpecifiedAmount(uint256 amount) public {
        StakingToken yakStakingContract = StakingToken(avaxStakingContractAddress);
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
}
