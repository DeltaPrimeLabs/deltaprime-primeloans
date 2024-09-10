pragma solidity ^0.8.27;

interface ILTIPFacet {
    function getLTIPEligibleTVL() external view returns (uint256);
}
