// SPDX-License-Identifier: MIT
// Last deployed from commit: ;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "../lib/DiamondStorageLib.sol";

contract TestFacet {
    function testFunc() external onlyOwner {
    }

    modifier onlyOwner() {
        DiamondStorageLib.enforceIsContractOwner();
        _;
    }
}
