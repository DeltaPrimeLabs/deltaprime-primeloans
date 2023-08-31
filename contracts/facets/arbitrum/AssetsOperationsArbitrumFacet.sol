// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 7e22b7d75964adcf61a05fe6444ce40a63f9e2b1;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";

contract AssetsOperationsArbitrumFacet is AssetsOperationsFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xb32C79a25291265eF240Eb32E9faBbc6DcEE3cE3;
    }
}
