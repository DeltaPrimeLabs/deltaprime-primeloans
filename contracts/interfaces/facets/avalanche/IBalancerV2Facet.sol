pragma solidity ^0.8.17;

import "../../balancer-v2/IBalancerV2Vault.sol";

interface IBalancerV2Facet {
    function joinPoolAndStakeBalancerV2(bytes32 poolId, IVault.JoinPoolRequest memory request) external;

    function unstakeAndExitPoolBalancerV2(bytes32 poolId, IVault.ExitPoolRequest memory request) external;

}
