pragma solidity ^0.8.4;

import "./MockSmartLoanLogicFacetRedstoneProvider.sol";

contract MockSmartLoanLogicFacetSetValues is MockSmartLoanLogicFacetRedstoneProvider {
    function getLTV() override public pure returns(uint256) {
        return 0;
    }
}