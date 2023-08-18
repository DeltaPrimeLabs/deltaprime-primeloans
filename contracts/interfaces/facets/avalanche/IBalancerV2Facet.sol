pragma solidity ^0.8.17;

import "../../balancer-v2/IBalancerV2Vault.sol";

interface IBalancerV2Facet {
    struct UnstakeRequest {
        bytes32 poolId;
        address unstakedToken;
        uint256 unstakedAmount;
        uint256 bptAmount;
    }

    function joinPoolAndStakeBalancerV2(bytes32 poolId, IAsset[] memory stakedTokens, uint256[] memory stakedAmounts, uint256 minBptAmount) external;

    function unstakeAndExitPoolBalancerV2(UnstakeRequest memory request) external;

}
