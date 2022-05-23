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

    /**
     * Dummy implementation used to test SmartLoanDiamond LTV logic
     **/
    function getTotalValue() public view override returns (uint256) {
        return value;
    }

    function calculateAssetsValue(bytes32[] memory assets, uint256[] memory prices) internal view virtual override returns (uint256) {
        return value;
    }

    function getDebt() public view override returns (uint256) {
        return debt;
    }

    function calculateDebt(bytes32[] memory assets, uint256[] memory prices) internal view virtual override returns (uint256) {
        return debt;
    }

    function getLTV() public view override returns (uint256) {
        return calculateLTV(new bytes32[](0), new uint256[](0));
    }
}