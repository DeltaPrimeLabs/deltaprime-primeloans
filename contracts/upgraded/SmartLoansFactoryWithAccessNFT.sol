// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: 0fbd3d2132ce3d3a12c966ee5e6ffba53aae9d33;
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../SmartLoansFactory.sol";

contract SmartLoansFactoryWithAccessNFT is NFTAccess, SmartLoansFactory {
    function createLoan() public override oneLoanPerOwner hasAccessNFT returns (SmartLoan) {
        return super.createLoan();
    }

    function createAndFundLoan(bytes32 fundedAsset, uint256 _amount, uint256 _initialDebt) public override oneLoanPerOwner hasAccessNFT returns (SmartLoan) {
        return super.createAndFundLoan(fundedAsset, _amount, _initialDebt);
    }
}
