// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IDepositRewarder.sol";

contract DepositRewarder is IDepositRewarder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //                                        STORAGE                                            //
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /// @notice Pool address
    address public pool;

    /// @notice Duration of rewards to be paid out (in seconds)
    uint256 public duration;

    /// @notice Timestamp of when the rewards finish
    uint256 public finishAt;

    /// @notice Minimum of last updated time and reward finish time
    uint256 public updatedAt;

    /// @notice Reward to be paid out per second
    uint256 public rewardRate;

    /// @notice Sum of (reward rate * dt * 1e18 / total supply)
    uint256 public rewardPerTokenStored;

    /// @notice User address => rewardPerTokenStored
    mapping(address => uint256) public userRewardPerTokenPaid;

    /// @notice User address => rewards to be claimed
    mapping(address => uint256) public rewards;

    /// @notice Total deposited
    uint256 public totalSupply;

    /// @notice User address => deposited amount
    mapping(address => uint256) public balanceOf;

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //                                        ERRORS                                             //
    ///////////////////////////////////////////////////////////////////////////////////////////////

    /// @notice Error for when an address parameter passed is invalid
    error InvalidAddress();

    /// @notice Error for when msg.sender is unauthorized
    error Unauthorized();

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //                                        EVENTS                                             //
    ///////////////////////////////////////////////////////////////////////////////////////////////

    event Deposited(
        address indexed account,
        uint256 indexed amount,
        uint256 timestamp
    );

    event Withdrawn(
        address indexed account,
        uint256 indexed amount,
        uint256 timestamp
    );

    event BatchDeposited(
        address[] accounts,
        uint256 timestamp
    );

    ///////////////////////////////////////////////////////////////////////////////////////////////
    //                                       MODIFIERS                                           //
    ///////////////////////////////////////////////////////////////////////////////////////////////

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        if (_account != address(0)) {
            rewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }

        _;
    }

    modifier onlyPool() {
        if (msg.sender != pool) {
            revert Unauthorized();
        }

        _;
    }

    constructor(address pool_) {
        if (pool_ == address(0)) {
            revert InvalidAddress();
        }

        pool = pool_;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return _min(finishAt, block.timestamp);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return
            rewardPerTokenStored +
            (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) /
            totalSupply;
    }

    function addDeposits(address[] memory accounts) external onlyOwner {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        uint256 length = accounts.length;
        for (uint256 i; i != length; ++i) {
            address account = accounts[i];
            uint256 balance = IERC20(pool).balanceOf(account);
            uint256 oldBalance = balanceOf[account];
            balanceOf[account] = balance;
            totalSupply = totalSupply + balance - oldBalance;
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }

        emit BatchDeposited(accounts, block.timestamp);
    }

    function stakeFor(
        uint256 amount,
        address account
    ) external onlyPool updateReward(account) {
        balanceOf[account] += amount;
        totalSupply += amount;

        emit Deposited(account, amount, block.timestamp);
    }

    function withdrawFor(
        uint256 amount,
        address account
    ) external onlyPool updateReward(account) returns (uint256) {
        amount = Math.min(balanceOf[account], amount);

        balanceOf[account] -= amount;
        totalSupply -= amount;

        emit Withdrawn(account, amount, block.timestamp);

        return amount;
    }

    function earned(address _account) public view returns (uint256) {
        return
            ((balanceOf[_account] *
                (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
            rewards[_account];
    }

    function getRewardsFor(
        address payable _user
    ) external nonReentrant updateReward(_user) {
        uint256 reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            (bool sent, ) = _user.call{value: reward}("");
            require(sent, "Failed to send Ether");
        }
    }

    function setRewardsDuration(uint256 _duration) external onlyOwner {
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
            uint256 remainingRewards = (finishAt - block.timestamp) * rewardRate;
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

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x <= y ? x : y;
    }
}
