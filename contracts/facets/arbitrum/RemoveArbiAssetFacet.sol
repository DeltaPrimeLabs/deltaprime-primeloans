// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 64aac14edbacb47ae29adb98d3b856a351895646;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

contract RemoveArbiAssetFacet  {
    function removeArbiAsset() external {
        require(msg.sender == 0xDB246e0fc9029fFBFE93F60399Edcf3cf279901c, "Wrong msg.sender");
        DiamondStorageLib.removeOwnedAsset("ARBI");
    }
}
