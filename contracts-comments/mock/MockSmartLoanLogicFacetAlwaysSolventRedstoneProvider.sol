pragma solidity ^0.8.4;

import "./MockSmartLoanLogicFacetRedstoneProvider.sol";

contract MockSmartLoanLogicFacetAlwaysSolventRedstoneProvider is MockSmartLoanLogicFacetRedstoneProvider {

    function _isSolvent() internal override returns (bool) {
        return true;
    }
}