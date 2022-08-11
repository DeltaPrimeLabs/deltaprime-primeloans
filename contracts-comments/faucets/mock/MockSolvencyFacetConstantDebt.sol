pragma solidity ^0.8.4;

contract MockSolvencyFacetAlwaysSolvent {
    /**
    * Always returns true - used in test suits
    **/
    function isSolvent() public view returns (bool) {
        return true;
    }
}
