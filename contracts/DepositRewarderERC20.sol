// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "./DepositRewarderAbstract.sol";

contract DepositRewarderERC20 is DepositRewarderAbstract {
    using SafeERC20 for IERC20;

    /// @notice Reward token
    IERC20 immutable rewardToken;

    constructor(
        IERC20 rewardToken_,
        address pool_
    ) DepositRewarderAbstract(pool_) {
        if (address(rewardToken_) == address(0)) {
            revert InvalidAddress();
        }

        rewardToken = rewardToken_;
    }

    function getRewardsFor(
        address payable _user
    ) external override nonReentrant updateReward(_user) {
        uint256 reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            rewardToken.safeTransfer(_user, reward);
        }
    }
}
