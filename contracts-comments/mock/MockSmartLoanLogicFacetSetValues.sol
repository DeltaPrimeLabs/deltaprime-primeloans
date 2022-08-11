pragma solidity ^0.8.4;

contract MockSolvencyFacetConstantDebt {
    /**
    * Always returns 2137 - used in test suits
    **/
    function getDebt() public view returns (uint256) {
        return 2137;
    }
}
