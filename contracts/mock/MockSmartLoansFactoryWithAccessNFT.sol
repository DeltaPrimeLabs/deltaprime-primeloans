// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: ;
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../SmartLoansFactory.sol";

contract MockSmartLoansFactoryWithAccessNFT is NFTAccess, SmartLoansFactory {
    function createLoan() public override hasAccessNFT returns (SmartLoanDiamond) {
        return super.createLoan();
    }

    function createAndFundLoan(bytes32 _fundedAsset, address _assetAddress, uint256 _amount, bytes32 _debtAsset, uint256 _initialDebt) public override hasAccessNFT returns (SmartLoanDiamond) {
        return super.createAndFundLoan(_fundedAsset, _assetAddress, _amount, _debtAsset, _initialDebt);
    }
}
