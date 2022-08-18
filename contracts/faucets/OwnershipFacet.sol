// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "../lib/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";
import "../lib/SmartLoanLib.sol";
import "../SmartLoansFactory.sol";
import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";

contract OwnershipFacet is IERC173 {
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        SmartLoansFactory(SmartLoanLib.getSmartLoansFactoryAddress()).executeOwnershipTransfer(msg.sender, _newOwner);
        LibDiamond.setContractOwner(_newOwner);
    }

    function owner() external override view returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}