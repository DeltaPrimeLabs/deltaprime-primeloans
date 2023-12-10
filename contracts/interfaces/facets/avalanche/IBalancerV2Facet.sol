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

    function balancerSAvaxBalance() external returns(uint256);

    function balancerYyAvaxBalance() external returns(uint256);

    function balancerGgAvaxBalance() external returns(uint256);

    event StakedBalancerV2(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    event BptStaked(address indexed user, bytes32 asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

    event UnstakedBalancerV2(address indexed user, bytes32[] assets, address indexed vault, uint256[] depositTokenAmounts, uint256 receiptTokenAmount, uint256 timestamp);

    event BptUnstakedBalancerV2(address indexed user, bytes32 asset, address indexed vault, uint256 depositTokenAmount, uint256 receiptTokenAmount, uint256 timestamp);

}