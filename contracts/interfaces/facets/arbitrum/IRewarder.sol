pragma solidity ^0.8.27;

interface IRewarder {
    function pendingTokens(uint256 pid, address user, uint256 sushiAmount) external view returns (address[] memory, uint256[] memory);
}
