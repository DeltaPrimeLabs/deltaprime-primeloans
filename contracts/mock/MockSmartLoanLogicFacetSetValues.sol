pragma solidity ^0.8.4;

import "./MockSmartLoanLogicFacetRedstoneProvider.sol";

contract MockSmartLoanLogicFacetSetValues is MockSmartLoanLogicFacetRedstoneProvider {
    uint256 debt = 777;
    uint256 value = 999;

    function setDebt(uint256 _newDebt) public {
        debt = _newDebt;
    }

    function setValue(uint256 _newValue) public {
        value = _newValue;
    }

    function getTotalValue() public view override returns (uint256) {
        return value;
    }

    function getDebt() public view override returns (uint256) {
        return debt;
    }
}