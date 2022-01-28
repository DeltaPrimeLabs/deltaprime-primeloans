// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
import "../abstract/NFTAccess.sol";
import "../SmartLoansFactory.sol";

contract SmartLoansFactoryWithAccessNFT is NFTAccess, SmartLoansFactory {
    function createLoan() external override oneLoanPerOwner hasAccessNFT returns (SmartLoan) {
        BeaconProxy beaconProxy = new BeaconProxy(
            payable(address(upgradeableBeacon)),
            abi.encodeWithSelector(SmartLoan.initialize.selector, address(assetsExchange), address(pool), 0)
        );
        SmartLoan smartLoan = SmartLoan(payable(address(beaconProxy)));

        //Update registry and emit event
        updateRegistry(smartLoan);
        smartLoan.transferOwnership(msg.sender);

        emit SmartLoanCreated(address(smartLoan), msg.sender, 0, 0);
        return smartLoan;
    }

    function createAndFundLoan(uint256 _initialDebt) external override payable oneLoanPerOwner hasAccessNFT returns (SmartLoan) {
        BeaconProxy beaconProxy = new BeaconProxy(payable(address(upgradeableBeacon)),
            abi.encodeWithSelector(SmartLoan.initialize.selector, address(assetsExchange), address(pool)));
        SmartLoan smartLoan = SmartLoan(payable(address(beaconProxy)));

        //Update registry and emit event
        updateRegistry(smartLoan);

        //Fund account with own funds and credit
        smartLoan.fund{value: msg.value}();

        proxyCalldata(address(smartLoan), abi.encodeWithSelector(SmartLoan.borrow.selector, _initialDebt));

        smartLoan.transferOwnership(msg.sender);

        emit SmartLoanCreated(address(smartLoan), msg.sender, msg.value, _initialDebt);

        return smartLoan;
    }
}
