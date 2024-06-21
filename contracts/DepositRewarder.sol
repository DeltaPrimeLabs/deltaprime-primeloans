// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IDepositRewarder.sol";

contract DepositRewarder is IDepositRewarder, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    // Duration of rewards to be paid out (in seconds)
    uint public duration;
    // Timestamp of when the rewards finish
    uint public finishAt;
    // Minimum of last updated time and reward finish time
    uint public updatedAt;
    // Reward to be paid out per second
    uint public rewardRate;
    // Sum of (reward rate * dt * 1e18 / total supply)
    uint public rewardPerTokenStored;
    // User address => rewardPerTokenStored
    mapping(address => uint) public userRewardPerTokenPaid;
    // User address => rewards to be claimed
    mapping(address => uint) public rewards;

    // Total deposited
    uint public totalSupply;
    // User address => deposited amount
    mapping(address => uint) public balanceOf;

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }

        _;
    }

    function lastTimeRewardApplicable() public view returns (uint) {
        return _min(finishAt, block.timestamp);
    }

    function rewardPerToken() public view returns (uint) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }
    
        return
            rewardPerTokenStored +
            (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) /
            totalSupply;
    }

    function addDeposits(uint256[] memory amountList, address[] memory userList) external onlyOwner {
        require(userList.length == amountList.length, "Length Mismatch");

        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        for(uint256 i = 0 ; i < userList.length ; i ++) {
            uint256 amount = amountList[i];
            address account = userList[i];
            balanceOf[account] = amount;
            totalSupply += amount;
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        emit BatchDeposited(userList, amountList, block.timestamp);
    }

    function earned(address _account) public view returns (uint) {
        return
            ((balanceOf[_account] *
            (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
            rewards[_account];
    }

    function getRewardsFor(address payable _user) external nonReentrant updateReward(_user) {
        uint reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            (bool sent, ) = _user.call{value: reward}("");
            require(sent, "Failed to send Ether");
        }
    }

    function setRewardsDuration(uint _duration) external onlyOwner {
        require(finishAt < block.timestamp, "reward duration not finished");
        duration = _duration;
    }

    function notifyRewardAmount()
    external
    payable
    onlyOwner
    updateReward(address(0))
    {
        if (block.timestamp >= finishAt) {
            rewardRate = msg.value / duration;
        } else {
            uint remainingRewards = (finishAt - block.timestamp) * rewardRate;
            rewardRate = (msg.value + remainingRewards) / duration;
        }

        require(rewardRate > 0, "reward rate = 0");
        require(
            rewardRate * duration <= address(this).balance,
            "reward amount > balance"
        );

        finishAt = block.timestamp + duration;
        updatedAt = block.timestamp;
    }

    function _min(uint x, uint y) private pure returns (uint) {
        return x <= y ? x : y;
    }

    event BatchDeposited(address[] userList, uint256[] amountList, uint256 timestamp);
}
