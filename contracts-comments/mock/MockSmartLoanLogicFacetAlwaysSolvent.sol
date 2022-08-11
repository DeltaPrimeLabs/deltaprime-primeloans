pragma solidity ^0.8.4;

import "../faucets/SmartLoanLogicFacet.sol";

contract MockSmartLoanLogicFacetAlwaysSolvent is SmartLoanLogicFacet {

    function _isSolvent() internal override returns (bool) {
        return true;
    }
}