// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: b008d1cca9fa95e6f83e76e6ee4dcf958513a113;
pragma solidity 0.8.17;

import {DiamondStorageLib} from "../../lib/DiamondStorageLib.sol";

contract RemoveArbiAssetFacet  {
    function removeArbiAsset() external {
        require(msg.sender == 0x5D80a1c0a5084163F1D2620c1B1F43209cd4dB12, "Wrong msg.sender");
        DiamondStorageLib.removeOwnedAsset("ARBI");
    }
}
