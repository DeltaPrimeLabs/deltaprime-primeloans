// SPDX-License-Identifier: PRIVATE
// all rights reserved to Hexagate

pragma solidity ^0.8.27;

import {IGator} from "./Gator.sol";

abstract contract GatorClient {
    // keccak32("gatorclient.gator")
    bytes32 private constant GATOR_SLOT = 0xa53f6f8ec545fba22c6f5161ad4c3981dee87a9993a6055a4c0ede893f9496e3;

    /**
     * @dev Reads the gator address from `GATOR_SLOT` storage slot
     */
    function gator() public view returns (IGator gatorAddress) {
        assembly {
            gatorAddress := sload(GATOR_SLOT)
        }
    }

    /**
     * @dev Sets the gator address stored in `GATOR_SLOT` storage slot
     */
    function _setGator(address _gator) internal {
        assembly {
            sstore(GATOR_SLOT, _gator)
        }
    }

    /**
     * @dev Calls gator with the current function selector
     * to check if the flow is approved
     */
    modifier gated() {
        IGator _gator = gator();
        if (address(_gator) == address(0)) {
            _;
            return;
        }

        // calldataload(0) loads the first 32 bytes of calldata,
        // and the assignment to `selector` which is a bytes4 variable
        // truncates it to the first 4 bytes of the calldata
        bytes4 selector;
        assembly {
            selector := calldataload(0)
        }

        _gator.enter(selector);
        _;
        _gator.exit(selector);
    }
}
