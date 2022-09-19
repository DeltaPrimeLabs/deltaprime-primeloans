
// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.0;

import { DiamondStorageLib } from "../lib/DiamondStorageLib.sol";
import "../SmartLoansFactory.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract OwnershipFacet {
    function transferOwnership(address _newOwner) external {
        DiamondStorageLib.enforceIsContractOwner();
        require(_newOwner != msg.sender, "Can't propose oneself as a contract owner");
        require(SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).getLoanForOwner(_newOwner) == address(0),
            "Can't propose an address that already has a loan");
        DiamondStorageLib.setPendingOwner(_newOwner);

        emit OwnershipTransferStarted(owner(), _newOwner);
    }

    function acceptOwnership() external {
        require(DiamondStorageLib.pendingOwner() == msg.sender, "Only a proposed user can accept ownership");
        DiamondStorageLib.setContractOwner(msg.sender);
        DiamondStorageLib.setPendingOwner(address(0));
        SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).changeOwnership(msg.sender);
    }

    function owner() public view returns (address owner_) {
        owner_ = DiamondStorageLib.contractOwner();
    }

    function pendingOwner() public view returns (address pendingOwner_) {
        pendingOwner_ = DiamondStorageLib.pendingOwner();
    }

    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
}