// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: f97d683e94fbb14f55819d6782c1f6a20998b10e;
pragma solidity 0.8.17;

import "redstone-evm-connector/lib/contracts/commons/ProxyConnector.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./SmartLoanDiamondBeacon.sol";
import "./proxies/SmartLoanDiamondProxy.sol";
import "./facets/AssetsOperationsFacet.sol";
import "./facets/OwnershipFacet.sol";
import "./facets/SmartLoanViewFacet.sol";

/**
 * @title SmartLoansFactory
 * @dev Contract responsible for creating new instances of SmartLoans (SmartLoanDiamondBeacon).
 * It's possible to either simply create a new loan or create and fund it with an ERC20 asset as well as borrow in a single transaction.
 * At the time of creating a loan, SmartLoansFactory contract is the owner for the sake of being able to perform the fund() and borrow() operations.
 * At the end of the createAndFundLoan the ownership is transferred to the msg.sender.
 * It's also responsible for keeping track of the loans, ensuring one loan per wallet rule, ownership transfers proposals/execution and
 * authorizes registered loans to borrow from lending pools.
 */
contract SmartLoansFactory is OwnableUpgradeable, IBorrowersRegistry {
    using TransferHelper for address;

    modifier hasNoLoan() {
        require(!_hasLoan(msg.sender), "Only one loan per owner is allowed");
        _;
    }


    SmartLoanDiamondBeacon public smartLoanDiamond;

    mapping(address => address) public ownersToLoans;
    mapping(address => address) public loansToOwners;

    address[] loans;

    function _hasLoan(address user) internal view returns (bool) {
        return ownersToLoans[user] != address(0);
    }

    function changeOwnership(address _newOwner) public {
        address loan = msg.sender;
        address oldOwner = loansToOwners[loan];

        require(oldOwner != address(0), "Only a SmartLoan can change it's owner");
        require(!_hasLoan(_newOwner), "New owner already has a loan");

        ownersToLoans[oldOwner] = address(0);
        ownersToLoans[_newOwner] = loan;
        loansToOwners[loan] = _newOwner;
    }

    function initialize(address payable _smartLoanDiamond) external initializer {
        smartLoanDiamond = SmartLoanDiamondBeacon(_smartLoanDiamond);
        __Ownable_init();
    }

    function createLoan() public virtual hasNoLoan returns (SmartLoanDiamondBeacon) {
        SmartLoanDiamondProxy beaconProxy = new SmartLoanDiamondProxy(
            payable(address(smartLoanDiamond)),
        // Setting SLFactory as the initial owner and then using .transferOwnership to change the owner to msg.sender
        // It is possible to set msg.sender as the initial owner if our loan-creation flow would change
            abi.encodeWithSelector(SmartLoanViewFacet.initialize.selector, msg.sender)
        );
        SmartLoanDiamondBeacon smartLoan = SmartLoanDiamondBeacon(payable(address(beaconProxy)));

        //Update registry and emit event
        updateRegistry(address(smartLoan), msg.sender);

        emit SmartLoanCreated(address(smartLoan), msg.sender, "", 0);
        return smartLoan;
    }

    function createAndFundLoan(bytes32 _fundedAsset, address _assetAddress, uint256 _amount) public virtual hasNoLoan returns (SmartLoanDiamondBeacon) {
        SmartLoanDiamondProxy beaconProxy = new SmartLoanDiamondProxy(payable(address(smartLoanDiamond)),
            abi.encodeWithSelector(SmartLoanViewFacet.initialize.selector, msg.sender)
        );
        SmartLoanDiamondBeacon smartLoan = SmartLoanDiamondBeacon(payable(address(beaconProxy)));

        //Fund account with own funds and credit
        IERC20Metadata token = IERC20Metadata(_assetAddress);
        address(token).safeTransferFrom(msg.sender, address(this), _amount);
        token.approve(address(smartLoan), _amount);

        ProxyConnector.proxyCalldata(address(smartLoan), abi.encodeWithSelector(AssetsOperationsFacet.fund.selector, _fundedAsset, _amount), false);

        //Update registry and emit event
        updateRegistry(address(smartLoan), msg.sender);

        emit SmartLoanCreated(address(smartLoan), msg.sender, _fundedAsset, _amount);

        return smartLoan;
    }

    function updateRegistry(address loan, address owner) internal {
        ownersToLoans[owner] = loan;
        loansToOwners[loan] = owner;
        loans.push(loan);
    }

    function canBorrow(address _account) external view override returns (bool) {
        return loansToOwners[_account] != address(0);
    }

    function getLoanForOwner(address _user) external view override returns (address) {
        return ownersToLoans[_user];
    }

    function getOwnerOfLoan(address _loan) external view override returns (address) {
        return loansToOwners[_loan];
    }

    function getAllLoans() public view returns (address[] memory) {
        return loans;
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    function renounceOwnership() public virtual override {}

    /**
     * @dev emitted after creating a loan by the owner
     * @param accountAddress address of a new SmartLoanDiamondBeacon
     * @param creator account creating a SmartLoanDiamondBeacon
     * @param collateralAsset asset used as initial collateral
     * @param collateralAmount amount of asset used as initial collateral
     **/
    event SmartLoanCreated(address indexed accountAddress, address indexed creator, bytes32 collateralAsset, uint256 collateralAmount);
}