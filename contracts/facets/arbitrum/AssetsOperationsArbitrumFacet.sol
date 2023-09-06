// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: c195aca5cf83dae4082abd34c9484dd63ed8bb21;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";

contract AssetsOperationsArbitrumFacet is AssetsOperationsFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }
}
