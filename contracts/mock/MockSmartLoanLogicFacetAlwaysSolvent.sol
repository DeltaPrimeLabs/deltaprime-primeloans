pragma solidity ^0.8.4;

import "../faucets/SmartLoanLogicFacet.sol";

contract MockSmartLoanLogicFacetAlwaysSolvent is SmartLoanLogicFacet {

    function isSolvent() public view override returns (bool) {
        return true;
    }
}