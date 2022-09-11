
// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.0;

import { DiamondStorageLib } from "../lib/DiamondStorageLib.sol";
import { IERC173 } from "../interfaces/IERC173.sol";
import "../SmartLoansFactory.sol";

//This path is updated during deployment
import "../lib/local/DeploymentConstants.sol";

contract OwnershipFacet is IERC173 {
    function transferOwnership(address _newOwner) external override {
        DiamondStorageLib.enforceIsContractOwner();
        SmartLoansFactory(DeploymentConstants.getSmartLoansFactoryAddress()).executeOwnershipTransfer(msg.sender, _newOwner);
        DiamondStorageLib.setContractOwner(_newOwner);
    }

    function owner() external override view returns (address owner_) {
        owner_ = DiamondStorageLib.contractOwner();
    }
}