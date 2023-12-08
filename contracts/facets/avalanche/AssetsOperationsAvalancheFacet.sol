// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: cd227651daba2756b0ed59623fd404c32885e63d;
pragma solidity 0.8.17;

import "../AssetsOperationsFacet.sol";
import "../SmartLoanLiquidationFacet.sol";

contract AssetsOperationsAvalancheFacet is AssetsOperationsFacet {
    function YY_ROUTER() internal override pure returns (address) {
        return 0xC4729E56b831d74bBc18797e0e17A295fA77488c;
    }
}
