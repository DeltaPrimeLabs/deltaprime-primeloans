pragma solidity ^0.8.17;

interface IRecoveryFacet {
    function emergencyWithdraw(
        bytes32[] memory _assets
    ) external returns (uint256[] memory _amounts);
}
