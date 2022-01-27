// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "./SmartLoan.sol";
import "./Pool.sol";
import "./interfaces/IAssetsExchange.sol";
import "redstone-evm-connector/lib/contracts/message-based/ProxyConnector.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title SmartLoansFactory
 * It creates and fund the Smart Loan.
 * It's also responsible for keeping track of the loans and ensuring they follow the solvency protection rules
 * and could be authorised to access the lending pool.
 *
 */
contract SmartLoansFactory is OwnableUpgradeable, IBorrowersRegistry, ProxyConnector {
  modifier oneLoanPerOwner() {
    require(ownersToLoans[msg.sender] == address(0), "Only one loan per owner is allowed");
    _;
  }

  event SmartLoanCreated(address indexed accountAddress, address indexed creator, uint256 initialCollateral, uint256 initialDebt);

  Pool internal pool;
  IAssetsExchange assetsExchange;
  UpgradeableBeacon public upgradeableBeacon;

  mapping(address => address) public ownersToLoans;
  mapping(address => address) public loansToOwners;

  SmartLoan[] loans;

  function initialize(Pool _pool, IAssetsExchange _assetsExchange, SmartLoan _smartLoanImplementation) external initializer {
    pool = _pool;
    assetsExchange = _assetsExchange;
    upgradeableBeacon = new UpgradeableBeacon(address(_smartLoanImplementation));
    upgradeableBeacon.transferOwnership(msg.sender);
    __Ownable_init();
  }

  function createLoan() external virtual oneLoanPerOwner returns (SmartLoan) {
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

  function createAndFundLoan(uint256 _initialDebt) external virtual payable oneLoanPerOwner returns (SmartLoan) {
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

  function updateRegistry(SmartLoan loan) internal {
    ownersToLoans[msg.sender] = address(loan);
    loansToOwners[address(loan)] = msg.sender;
    loans.push(loan);
  }

  function canBorrow(address _account) external view override returns (bool) {
    return loansToOwners[_account] != address(0);
  }

  function getLoanForOwner(address _user) external view override returns (address) {
    return address(ownersToLoans[_user]);
  }

  function getOwnerOfLoan(address _loan) external view override returns (address) {
    return loansToOwners[_loan];
  }

  function getAllLoans() public view returns (SmartLoan[] memory) {
    return loans;
  }
}