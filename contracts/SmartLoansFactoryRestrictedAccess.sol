// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "./SmartLoansFactory.sol";

contract SmartLoansFactoryRestrictedAccess is SmartLoansFactory {
    mapping(address=>bool) canCreateLoan;
    
    function whitelistBorrowers(address[] memory _borrowers) external onlyOwner {

        for(uint i; i<_borrowers.length; i++){
            canCreateLoan[_borrowers[i]] = true;
            emit BorrowerWhitelisted(_borrowers[i], msg.sender, block.timestamp);
        }
    }

    function delistBorrowers(address[] memory _borrowers) external onlyOwner {
        for(uint i; i<_borrowers.length; i++){
            canCreateLoan[_borrowers[i]] = false;
            emit BorrowerDelisted(_borrowers[i], msg.sender, block.timestamp);
        }
    }

    function isBorrowerWhitelisted(address _borrower) public view returns(bool){
        return canCreateLoan[_borrower];
    }

    function createLoan() public virtual override hasNoLoan canCreatePrimeAccount(msg.sender) returns (SmartLoanDiamondBeacon) {
        return super.createLoan();
    }

    function createAndFundLoan(bytes32 _fundedAsset, address _assetAddress, uint256 _amount) public virtual override hasNoLoan canCreatePrimeAccount(msg.sender) returns (SmartLoanDiamondBeacon) {
        return super.createAndFundLoan(_fundedAsset, _assetAddress, _amount);
    }

    /**
     * @dev emitted when a new borrower gets whitelisted
     * @param borrower the address being whitelisted
     * @param performer the address initiating whitelisting
     * @param timestamp of the whitelisting
     **/
    event BorrowerWhitelisted(address indexed borrower, address performer, uint256 timestamp);
    
    /**
     * @dev emitted when a borrower gets delisted
     * @param borrower the address being delisted
     * @param performer the address initiating delisting
     * @param timestamp of the delisting
     **/
    event BorrowerDelisted(address indexed borrower, address performer, uint256 timestamp);

    modifier canCreatePrimeAccount(address _borrower) {
        require(isBorrowerWhitelisted(_borrower), "Only whitelisted borrowers can create a Prime Account.");
        _;
    }
}
