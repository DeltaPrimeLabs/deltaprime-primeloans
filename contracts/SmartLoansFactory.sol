// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./SmartLoan.sol";
import "./proxies/DiamondBeaconProxy.sol";
import "./faucets/DiamondInit.sol";
import "./faucets/SmartLoanLogicFacet.sol";
import "./faucets/OwnershipFacet.sol";

/**
 * @title SmartLoansFactory
 * It creates and fund the Smart Loan.
 * It's also responsible for keeping track of the loans and ensuring they follow the solvency protection rules
 * and could be authorised to access the lending pool.
 *
 */
contract SmartLoansFactory is OwnableUpgradeable, IBorrowersRegistry {
  modifier oneLoanPerOwner() {
    require(ownersToLoans[msg.sender] == address(0), "Only one loan per owner is allowed");
    _;
  }

  SmartLoan public smartLoanRouter;

  mapping(address => address) public ownersToLoans;
  mapping(address => address) public loansToOwners;

  SmartLoan[] loans;

  function initialize(address payable _smartLoanRouter) external initializer {
    smartLoanRouter = SmartLoan(_smartLoanRouter);
    __Ownable_init();
  }

  function createLoan() public virtual oneLoanPerOwner returns (SmartLoan) {
    DiamondBeaconProxy beaconProxy = new DiamondBeaconProxy(
      payable(address(smartLoanRouter)),
      abi.encodeWithSelector(DiamondInit.init.selector)
    );
    SmartLoan smartLoan = SmartLoan(payable(address(beaconProxy)));

    //Update registry and emit event
    updateRegistry(smartLoan);
    OwnershipFacet(address(smartLoan)).transferOwnership(msg.sender);

    emit SmartLoanCreated(address(smartLoan), msg.sender, "", 0, 0);
    return smartLoan;
  }

  function createAndFundLoan(bytes32 fundedAsset, uint256 _amount, uint256 _initialDebt) public virtual oneLoanPerOwner returns (SmartLoan) {
    DiamondBeaconProxy beaconProxy = new DiamondBeaconProxy(payable(address(smartLoanRouter)),
      abi.encodeWithSelector(DiamondInit.init.selector)
    );
    SmartLoan smartLoan = SmartLoan(payable(address(beaconProxy)));

    //Update registry and emit event
    updateRegistry(smartLoan);

    //Fund account with own funds and credit
    ProxyConnector.proxyCalldata(address(smartLoan), abi.encodeWithSelector(SmartLoanLogicFacet.fund.selector), false);

    ProxyConnector.proxyCalldata(address(smartLoan), abi.encodeWithSelector(SmartLoanLogicFacet.borrow.selector, fundedAsset, _initialDebt), false);

    OwnershipFacet(address(smartLoan)).transferOwnership(msg.sender);

    emit SmartLoanCreated(address(smartLoan), msg.sender, fundedAsset, _amount, _initialDebt);

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

  /**
   * @dev emitted after closing a loan by the owner
   * @param accountAddress address of a new SmartLoan
   * @param accountAddress account creating a SmartLoan
   * @param collateralAsset asset used as initial collateral
   * @param collateralAmount amount of asset used as initial collateral
   * @param initialDebt initial debt of a SmartLoan
   **/
  event SmartLoanCreated(address indexed accountAddress, address indexed creator, bytes32 collateralAsset, uint256 collateralAmount, uint256 initialDebt);
}