// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f0764fb93f51c64f2def5256317eacea84e45913;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";

contract AssetsOperationsArbitrumFacet is AssetsOperationsFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }

    function removeDpxAssets() external {
        DiamondStorageLib.removeOwnedAsset("DPX");
        DiamondStorageLib.removeOwnedAsset("SUSHI_DPX_ETH_LP");
    }
}
