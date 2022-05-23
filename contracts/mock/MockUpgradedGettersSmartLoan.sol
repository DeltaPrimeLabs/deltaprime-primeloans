//// SPDX-License-Identifier: UNLICENSED
//// Last deployed from commit: ;
//pragma solidity ^0.8.4;
//
//import "./MockSmartLoanRedstoneProvider.sol";
//
///**
// * @title SmartLoanDiamond
// * A contract that is authorised to borrow funds using delegated credit.
// * It maintains solvency calculating the current value of assets and borrowings.
// * In case the value of assets held drops below certain level, part of the funds may be forcibly repaid.
// * It permits only a limited and safe token transfer.
// *
// */
//contract MockUpgradedGettersSmartLoan is MockSmartLoanRedstoneProvider {
//  function getMaxLtv() override public pure returns(uint256) {
//    return 200;
//  }
//
//  function getMinSelloutLtv() override public pure returns(uint256) {
//    return 400;
//  }
//
//  function getTotalValue() override public pure returns (uint256) {
//    return 777;
//  }
//
//  function getPercentagePrecision() override public pure returns (uint256) {
//    return 1001;
//  }
//
//  function getPoolAddress(bytes32 poolToken) override public view returns (address) {
//    return address(0);
//  }
//
//  function getExchange() override public view returns (IAssetsExchange) {
//    return IAssetsExchange(address(0));
//  }
//}
