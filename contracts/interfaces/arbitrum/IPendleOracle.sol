pragma solidity ^0.8.17;

interface IPendleOracle {
    function getLpToAssetRate(
        address market,
        uint256 duration
    ) external view returns (uint256);

    function getLpToSyRate(
        address market,
        uint256 duration
    ) external view returns (uint256);
}
