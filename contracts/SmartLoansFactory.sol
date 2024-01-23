// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: 33842ab4d1a332ccd47fb1cd2bb991e771922080;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/core/ProxyConnector.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./SmartLoanDiamondBeacon.sol";
import "./proxies/SmartLoanDiamondProxy.sol";
import "./facets/AssetsOperationsFacet.sol";
import "./facets/OwnershipFacet.sol";
import "./facets/SmartLoanViewFacet.sol";
import "./interfaces/ITokenManager.sol";

/**
 * @title SmartLoansFactory
 * @dev Contract responsible for creating new instances of SmartLoans (SmartLoanDiamondBeacon).
 * It's possible to either simply create a new loan or create and fund it with an ERC20 asset as well as borrow in a single transaction.
 * At the time of creating a loan, SmartLoansFactory contract is the owner for the sake of being able to perform the fund() and borrow() operations.
 * At the end of the createAndFundLoan the ownership is transferred to the msg.sender.
 * It's also responsible for keeping track of the loans, ensuring one loan per wallet rule, ownership transfers proposals/execution and
 * authorizes registered loans to borrow from lending pools.
 */
contract SmartLoansFactory is OwnableUpgradeable, IBorrowersRegistry, ProxyConnector {
    using TransferHelper for address;
    using TransferHelper for address payable;

    modifier hasNoLoan() {
        require(!_hasLoan(msg.sender), "Only one loan per owner is allowed");
        _;
    }

    modifier validReferralCode(bytes32 referralCode) {
        if (referralCode == bytes32(0) || referrers[referralCode] != address(0)) {
            _;
            return;
        }

        revert("Invalid referral code");
    }

    SmartLoanDiamondBeacon public smartLoanDiamond;

    mapping(address => address) public ownersToLoans;
    mapping(address => address) public loansToOwners;

    /// @notice Referrer => Referral Code
    mapping(address => bytes32) public referralCodes;
    /// @notice Referral Code => Referrer
    mapping(bytes32 => address) public referrers;
    /// @notice Referrer => Fee Asset
    mapping(address => bytes32) public feeAssets;

    address[] loans;

    ITokenManager public tokenManager;

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

    function initialize(address payable _smartLoanDiamond, address _tokenManager) external initializer {
        smartLoanDiamond = SmartLoanDiamondBeacon(_smartLoanDiamond);
        tokenManager = ITokenManager(_tokenManager);
        __Ownable_init();
    }

    function setTokenManager(address _tokenManager) external onlyOwner {
        tokenManager = ITokenManager(_tokenManager);
    }

    function createLoan(bytes32 referralCode) public virtual hasNoLoan validReferralCode(referralCode) returns (SmartLoanDiamondBeacon) {
        SmartLoanDiamondProxy beaconProxy = new SmartLoanDiamondProxy(
            payable(address(smartLoanDiamond)),
        // Setting SLFactory as the initial owner and then using .transferOwnership to change the owner to msg.sender
        // It is possible to set msg.sender as the initial owner if our loan-creation flow would change
            abi.encodeWithSelector(SmartLoanViewFacet.initialize.selector, msg.sender, referrers[referralCode])
        );
        SmartLoanDiamondBeacon smartLoan = SmartLoanDiamondBeacon(payable(address(beaconProxy)));

        //Update registry and emit event
        updateRegistry(address(smartLoan), msg.sender);

        emit SmartLoanCreated(address(smartLoan), msg.sender, "", 0);
        return smartLoan;
    }

    function createAndFundLoan(bytes32 _fundedAsset, uint256 _amount, bytes32 referralCode) public virtual hasNoLoan validReferralCode(referralCode) returns (SmartLoanDiamondBeacon) {
        address asset = tokenManager.getAssetAddress(_fundedAsset, false);
        SmartLoanDiamondProxy beaconProxy = new SmartLoanDiamondProxy(payable(address(smartLoanDiamond)),
            abi.encodeWithSelector(SmartLoanViewFacet.initialize.selector, msg.sender, referrers[referralCode])
        );
        SmartLoanDiamondBeacon smartLoan = SmartLoanDiamondBeacon(payable(address(beaconProxy)));

        //Fund account with own funds and credit
        IERC20Metadata token = IERC20Metadata(asset);
        address(token).safeTransferFrom(msg.sender, address(this), _amount);
        address(token).safeApprove(address(smartLoan), _amount);

        //Update registry and emit event
        updateRegistry(address(smartLoan), msg.sender);

        (bool success, bytes memory result) = address(smartLoan).call(abi.encodeWithSelector(AssetsOperationsFacet.fund.selector, _fundedAsset, _amount));
        ProxyConnector._prepareReturnValue(success, result);

        emit SmartLoanCreated(address(smartLoan), msg.sender, _fundedAsset, _amount);

        return smartLoan;
    }

    function updateRegistry(address loan, address owner) internal {
        ownersToLoans[owner] = loan;
        loansToOwners[loan] = owner;
        loans.push(loan);
    }

    function setReferralCode(bytes32 referralCode) external {
        require(referralCode != bytes32(0), "Invalid referral code");
        require(referrers[referralCode] == address(0), "Referral code used");
        address owner = msg.sender;
        address loan = ownersToLoans[owner];
        require(referralCodes[loan] == bytes32(0), "Already set referral code");
        referralCodes[loan] = referralCode;
        referrers[referralCode] = loan;

        emit ReferralCodeSet(owner, loan, referralCode);
    }

    function getReferrer(bytes32 referralCode) external view returns (address) {
        return referrers[referralCode];
    }

    function setFeeAsset(bytes32 feeAsset) external {
        address owner = msg.sender;
        address loan = ownersToLoans[owner];
        require(loan != address(0), "Don't have a loan");
        // validate asset
        tokenManager.getAssetAddress(feeAsset, false);
        feeAssets[loan] = feeAsset;
    }

    function getFeeAsset(address _account) external view returns (bytes32) {
        return feeAssets[_account];
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

    function getLoans(uint256 _from, uint256 _count) public view returns (address[] memory _loans) {
        uint256 length = loans.length;
        if (_from >= length) {
            _loans = new address[](0);
            return _loans;
        }

        if (_count > length - _from) {
            _count = length - _from;
        }
        _loans = new address[](_count);
        for (uint256 i; i != _count; ++i) {
            _loans[i] = loans[_from + i];
        }
    }

    function getLoansLength() external view returns (uint256) {
        return loans.length;
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

    /**
     * @dev emitted when user sets referral code
     * @param owner Owner address
     * @param loan Loan address
     * @param referralCode Referral code
     */
    event ReferralCodeSet(address indexed owner, address indexed loan, bytes32 referralCode);
}