// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 0fbd3d2132ce3d3a12c966ee5e6ffba53aae9d33;
pragma solidity ^0.8.17;

import "../abstract/NFTAccess.sol";
import "../SmartLoansFactory.sol";

contract SmartLoansFactoryWithAccessNFT is NFTAccess, SmartLoansFactory {
    function createLoan() public override hasNoLoan hasAccessNFT returns (SmartLoanDiamondBeacon) {
        return super.createLoan();
    }

    function createAndFundLoan(bytes32 _fundedAsset, address _assetAddress, uint256 _amount, bytes32 _debtAsset, uint256 _initialDebt) public override hasNoLoan hasAccessNFT returns (SmartLoanDiamondBeacon) {
        return super.createAndFundLoan(_fundedAsset, _assetAddress, _amount, _debtAsset, _initialDebt);
    }
}
