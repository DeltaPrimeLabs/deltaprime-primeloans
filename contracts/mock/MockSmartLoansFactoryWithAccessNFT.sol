// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../SmartLoansFactory.sol";

contract MockSmartLoansFactoryWithAccessNFT is NFTAccess, SmartLoansFactory {
    function createLoan() public override hasAccessNFT returns (SmartLoan) {
        return super.createLoan();
    }

    function createAndFundLoan(bytes32 fundedAsset, uint256 _amount, uint256 _initialDebt) public override hasAccessNFT returns (SmartLoan) {
        return super.createAndFundLoan(fundedAsset, _amount, _initialDebt);
    }
}
