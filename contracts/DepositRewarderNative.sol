// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "./DepositRewarderAbstract.sol";

contract DepositRewarderNative is DepositRewarderAbstract {
    constructor(address pool_) DepositRewarderAbstract(pool_) {
    }

    function getRewardsFor(
        address payable _user
    ) external override nonReentrant updateReward(_user) {
        uint256 reward = rewards[_user];
        if (reward > 0) {
            rewards[_user] = 0;
            (bool sent, ) = _user.call{value: reward}("");
            require(sent, "Failed to send native token");
        }
    }
}
