// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f63ef97516096bbd3db42914b6554a461f90ef40;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "./lib/DiamondStorageLib.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";

/**
 * @title SmartLoanDiamondBeacon
 * A contract that is authorised to borrow funds using delegated credit.
 * It maintains solvency calculating the current value of assets and borrowings.
 * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
 * It permits only a limited and safe token transfer.
 *
 */

contract SmartLoanDiamondBeacon {
    constructor(address _contractOwner, address _diamondCutFacet) payable {
        DiamondStorageLib.setContractOwner(_contractOwner);

        // Add the diamondCut external function from the diamondCutFacet
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        bytes4[] memory functionSelectors = new bytes4[](3);
        functionSelectors[0] = IDiamondCut.diamondCut.selector;
        functionSelectors[1] = IDiamondCut.pause.selector;
        functionSelectors[2] = IDiamondCut.unpause.selector;
        cut[0] = IDiamondCut.FacetCut({
        facetAddress : _diamondCutFacet,
        action : IDiamondCut.FacetCutAction.Add,
        functionSelectors : functionSelectors
        });
        DiamondStorageLib.diamondCut(cut, address(0), "");
    }

    function implementation() public view returns (address) {
        return address(this);
    }

    function getStatus() public view returns(bool) {
        DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
        return ds._active;
    }

    function implementation(bytes4 funcSignature) public view notPausedOrUpgrading returns (address) {
        DiamondStorageLib.DiamondStorage storage ds;
        bytes32 position = DiamondStorageLib.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = ds.selectorToFacetAndPosition[funcSignature].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        // Execute external function from facet using delegatecall and return any value.
        return facet;
    }


    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        address facet = implementation(msg.sig);
        // Execute external function from facet using delegatecall and return any value.
        assembly {
        // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
        // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
        // get any return value
            returndatacopy(0, 0, returndatasize())
        // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return (0, returndatasize())
            }
        }
    }

    modifier notPausedOrUpgrading() {
        // diamondCut(); unpause()
        if(msg.sig != 0x1f931c1c && msg.sig != 0x3f4ba83a) {
            DiamondStorageLib.DiamondStorage storage ds = DiamondStorageLib.diamondStorage();
            require(ds._active, "ProtocolUpgrade: paused.");
        }
        _;
    }
}