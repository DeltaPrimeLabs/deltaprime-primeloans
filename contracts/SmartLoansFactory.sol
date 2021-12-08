// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./SmartLoan.sol";
import "./Pool.sol";
import "./interfaces/IAssetsExchange.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";


/**
 * @title SmartLoansFactory
 * It creates and fund the Smart Loan.
 * It's also responsible for keeping track of the loans and ensuring they follow the solvency protection rules
 * and could be authorised to access the lending pool.
 *
 */
contract SmartLoansFactory is IBorrowersRegistry {

  modifier oneLoanPerOwner {
    if(ownersToLoans[msg.sender] != address(0)) revert TooManyLoans();
    _;
  }

  event SmartLoanCreated(address indexed accountAddress, address indexed creator);

  Pool private pool;
  IAssetsExchange assetsExchange;
  UpgradeableBeacon public upgradeableBeacon;

  mapping(address => address) public ownersToLoans;
  mapping(address => address) public loansToOwners;

  SmartLoan[] loans;

  constructor(
    Pool _pool,
    IAssetsExchange _assetsExchange
  ) {
    pool = _pool;
    assetsExchange = _assetsExchange;
    SmartLoan smartLoanImplementation = new SmartLoan();
    upgradeableBeacon = new UpgradeableBeacon(address(smartLoanImplementation));
    upgradeableBeacon.transferOwnership(msg.sender);
  }

  function createLoan() external oneLoanPerOwner returns(SmartLoan) {
    BeaconProxy beaconProxy = new BeaconProxy(payable(address(upgradeableBeacon)), abi.encodeWithSelector(SmartLoan.initialize.selector, address(assetsExchange), address(pool)));
    SmartLoan smartLoan = SmartLoan(payable(address(beaconProxy)));

    //Update registry and emit event
    updateRegistry(smartLoan);
    smartLoan.transferOwnership(msg.sender);

    return smartLoan;
  }

  function createAndFundLoan(uint256 _initialDebt) external oneLoanPerOwner payable returns(SmartLoan) {
    BeaconProxy beaconProxy = new BeaconProxy(payable(address(upgradeableBeacon)), abi.encodeWithSelector(SmartLoan.initialize.selector, address(assetsExchange), address(pool)));
    SmartLoan smartLoan = SmartLoan(payable(address(beaconProxy)));

    //Update registry and emit event
    updateRegistry(smartLoan);

    //Fund account with own funds and credit
    smartLoan.fund{value:msg.value}();
    smartLoan.borrow(_initialDebt);
    require(smartLoan.isSolvent());

    smartLoan.transferOwnership(msg.sender);

    return smartLoan;
  }

  function updateRegistry(SmartLoan loan) internal {
    ownersToLoans[msg.sender] = address(loan);
    loansToOwners[address(loan)] = msg.sender;
    loans.push(loan);

    emit SmartLoanCreated(address(loan), msg.sender);
  }

  function canBorrow(address _account) external view override returns(bool) {
    return loansToOwners[_account] != address(0);
  }

  function getLoanForOwner(address _user) external view override returns(address) {
    return address(ownersToLoans[_user]);
  }

  function getOwnerOfLoan(address _loan) external view override returns(address) {
    return loansToOwners[_loan];
  }

  function getAllLoans() public view returns(SmartLoan[] memory) {
    return loans;
  }

}


/// Only one loan per owner is allowed
error TooManyLoans();
