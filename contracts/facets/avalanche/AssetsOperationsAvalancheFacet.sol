// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 211845a5098c7691c01e65d90c62d976321f369b;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";
import "../SmartLoanLiquidationFacet.sol";

contract AssetsOperationsAvalancheFacet is AssetsOperationsFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }
}
