pragma solidity ^0.8.4;

import "./MockSmartLoanLogicFacetRedstoneProvider.sol";

contract MockSmartLoanLogicFacetAlwaysSolventRedstoneProvider is MockSmartLoanLogicFacetRedstoneProvider {

    function isSolvent() public view override returns (bool) {
        return true;
    }
}