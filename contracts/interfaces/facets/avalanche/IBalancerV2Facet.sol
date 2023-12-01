pragma solidity ^0.8.17;

import "../../balancer-v2/IBalancerV2Vault.sol";

interface IBalancerV2Facet {
    struct UnstakeRequest {
        bytes32 poolId;
        address unstakedToken;
        uint256 unstakedAmount;
        uint256 bptAmount;
    }

    struct StakeRequest {
        bytes32 poolId;
        address[] stakedTokens;
        uint256[] stakedAmounts;
        uint256 minBptAmount;
    }

    function joinPoolAndStakeBalancerV2(StakeRequest memory request) external;

    function stakeBalancerV2(bytes32 poolId, uint256 amount) external;

    function unstakeAndExitPoolBalancerV2(UnstakeRequest memory request) external;

    function unstakeBalancerV2(bytes32 poolId, uint256 amount) external;

    function claimRewardsBalancerV2(bytes32 poolId) external;

}
