pragma solidity ^0.8.17;

interface ISteakHutFinanceFacet {
    function stakeSteakHutAVAXUSDC(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutAVAXUSDC(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    function stakeSteakHutBTCAVAX(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutBTCAVAX(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    function stakeSteakHutUSDTeUSDT(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) external;

    function unstakeSteakHutUSDTeUSDT(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) external;

    event Staked(address indexed user, bytes32 asset0, bytes32 asset1, address indexed vault, uint256 depositTokenAmount0, uint256 depositTokenAmount1, uint256 receiptTokenAmount, uint256 timestamp);

    event Unstaked(address indexed user, bytes32 asset0, bytes32 asset1, address indexed vault, uint256 depositTokenAmount0, uint256 depositTokenAmount1, uint256 receiptTokenAmount, uint256 timestamp);

}
