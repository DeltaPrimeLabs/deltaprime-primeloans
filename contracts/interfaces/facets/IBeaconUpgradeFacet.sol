pragma solidity ^0.8.17;

interface IBeaconUpgradeFacet {
    function getBeacon() external view returns (address);

    function setBeacon(address newBeacon) external;
}
