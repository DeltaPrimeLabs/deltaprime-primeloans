pragma solidity ^0.8.17;

interface IHealthMeterFacet {
    function getHealthMeter() external view returns (uint256);
}
