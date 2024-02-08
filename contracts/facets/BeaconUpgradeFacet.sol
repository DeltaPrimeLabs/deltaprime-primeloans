// SPDX-License-Identifier: MIT
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";

import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";
import {IDiamondBeacon} from "../interfaces/IDiamondBeacon.sol";

contract BeaconUpgradeFacet {
    bytes32 internal constant _BEACON_SLOT = 0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    function getBeacon() external view returns (address) {
        return StorageSlot.getAddressSlot(_BEACON_SLOT).value;
    }

    function setBeacon(address newBeacon) external onlyOwner {
        require(Address.isContract(newBeacon), "ERC1967: new beacon is not a contract");
        require(
            Address.isContract(IDiamondBeacon(newBeacon).implementation()),
            "ERC1967: beacon implementation is not a contract"
        );
        StorageSlot.getAddressSlot(_BEACON_SLOT).value = newBeacon;
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
