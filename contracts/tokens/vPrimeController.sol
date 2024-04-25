// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity 0.8.17;

import "@redstone-finance/evm-connector/contracts/mocks/AuthorisedMockSignersBase.sol";
import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IBorrowersRegistry.sol";
import "../interfaces/IPool.sol";
import "./mock/sPrimeMock.sol";
import "./vPrime.sol";

contract vPrimeController is OwnableUpgradeable, RedstoneConsumerNumericBase, AuthorisedMockSignersBase {
    function getAuthorisedSignerIndex(address receivedSigner)
    public
    view
    virtual
    override
    returns (uint8)
    {
        return getAuthorisedMockSignerIndex(receivedSigner);
    }

    function validateTimestamp(uint256 receivedTimestampMilliseconds) public view virtual override {
        // Always pass
    }

    IPool[] public whitelistedPools;
    SPrimeMock[] public whitelistedSPrimeContracts;
    ITokenManager public tokenManager;
    vPrime public vPrimeContract;
    IBorrowersRegistry public borrowersRegistry;
    uint256 public constant BORROWER_YEARLY_V_PRIME_RATE = 1;
    uint256 public constant DEPOSITOR_YEARLY_V_PRIME_RATE = 5;
    uint256 public constant MAX_V_PRIME_VESTING_YEARS = 3;
    uint256 public constant V_PRIME_DETERIORATION_DAYS = 14;

    /* ========== INITIALIZER ========== */

    function initialize(IPool[] memory _whitelistedPools, SPrimeMock[] memory _whitelistedSPrimeContracts, ITokenManager _tokenManager, vPrime _vPrime) external initializer {
        whitelistedPools = _whitelistedPools;
        whitelistedSPrimeContracts = _whitelistedSPrimeContracts;
        tokenManager = _tokenManager;
        vPrimeContract = _vPrime;
        __Ownable_init();
    }


    /* ========== MUTATIVE EXTERNAL FUNCTIONS ========== */

    function updateVPrimeSnapshot(address userAddress) public {
        int256 vPrimeRate;
        uint256 vPrimeMaxCap;
        if(borrowersRegistry.canBorrow(userAddress)){   // It's a PrimeAccount
            (vPrimeRate, vPrimeMaxCap) = getBorrowerVPrimeRateAndMaxCap(userAddress);
            vPrimeContract.adjustRateAndCap(userAddress, vPrimeRate, vPrimeMaxCap);
        } else {
            uint256 alreadyVestedPrimeBalance;
            (vPrimeRate, vPrimeMaxCap, alreadyVestedPrimeBalance) = getDepositorVPrimeRateAndMaxCap(userAddress);
            // alreadyVestedPrimeBalance > 0 mean that the already vested vPrime is higher than the current balance
            if(alreadyVestedPrimeBalance > 0){
                vPrimeContract.adjustRateCapAndBalance(userAddress, vPrimeRate, vPrimeMaxCap, alreadyVestedPrimeBalance);
            } else {
                vPrimeContract.adjustRateAndCap(userAddress, vPrimeRate, vPrimeMaxCap);
            }
        }
    }


    /* ========== SETTERS ========== */


    /**
    * @notice Updates the list of whitelisted pools.
    * @dev Can only be called by the contract owner.
    * @param newWhitelistedPools An array of addresses representing the new list of whitelisted pools.
    */
    function updateWhitelistedPools(IPool[] memory newWhitelistedPools) external onlyOwner {
        whitelistedPools = newWhitelistedPools;
        emit WhitelistedPoolsUpdated(newWhitelistedPools, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the list of whitelisted sPrime contracts.
    * @dev Can only be called by the contract owner.
    * @param newWhitelistedSPrimeContracts An array of addresses representing the new list of whitelisted sPrime contracts.
    */
    function updateWhitelistedSPrimeContracts(SPrimeMock[] memory newWhitelistedSPrimeContracts) external onlyOwner {
        whitelistedSPrimeContracts = newWhitelistedSPrimeContracts;
        emit WhitelistedSPrimeContractsUpdated(newWhitelistedSPrimeContracts, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the token manager contract.
    * @dev Can only be called by the contract owner.
    * @param newTokenManager The address of the new token manager contract.
    */
    function updateTokenManager(ITokenManager newTokenManager) external onlyOwner {
        tokenManager = newTokenManager;
        emit TokenManagerUpdated(newTokenManager, msg.sender, block.timestamp);
    }

    /**
    * @notice Updates the borrowers registry contract.
    * @dev Can only be called by the contract owner.
    * @param newBorrowersRegistry The address of the new borrowers registry contract.
    */
    function updateBorrowersRegistry(IBorrowersRegistry newBorrowersRegistry) external onlyOwner {
        borrowersRegistry = newBorrowersRegistry;
    }



    /* ========== VIEW EXTERNAL FUNCTIONS ========== */

    function getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(address userAddress) public view returns (uint256 fullyVestedBalance, uint256 nonVestedBalance) {
        uint256 fullyVestedDollarValue = 0;
        uint256 nonVestedDollarValue = 0;
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(poolsTokenSymbols);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 poolBalance = IERC20(whitelistedPools[i]).balanceOf(userAddress);
            uint256 poolDollarValue = poolBalance * prices[i] * 1e10 / 10 ** whitelistedPools[i].decimals();
            uint256 fullyVestedToTotalBalanceRatio = whitelistedPools[i].getFullyVestedLockedBalanceToNonVestedRatio(userAddress); // potentially Pool can already return fully vested an non vested dollar value or token amounts
            fullyVestedToTotalBalanceRatio = fullyVestedToTotalBalanceRatio >= 1e18 ? 1e18 : fullyVestedToTotalBalanceRatio;
            fullyVestedDollarValue += poolDollarValue * fullyVestedToTotalBalanceRatio / 1e18;
            nonVestedDollarValue += poolDollarValue * (1e18 - fullyVestedToTotalBalanceRatio) / 1e18;
        }
        return (fullyVestedDollarValue, nonVestedDollarValue);
    }

    function getUserBorrowedDollarValueAcrossWhitelistedPools(address userAddress) public view returns (uint256) {
        uint256 totalDollarValue = 0;
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(poolsTokenSymbols);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 poolBorrowedAmount = whitelistedPools[i].getBorrowed(userAddress);
            uint256 poolDollarValue = poolBorrowedAmount * prices[i] * 1e10 / 10 ** whitelistedPools[i].decimals();
            totalDollarValue += poolDollarValue;
        }
        return totalDollarValue;
    }

    function getUserSPrimeDollarValueVestedAndNonVested(address userAddress) public view returns (uint256 fullyVestedBalance, uint256 nonVestedBalance) {
        uint256 fullyVestedDollarValue = 0;
        uint256 nonVestedDollarValue = 0;
        for (uint i = 0; i < whitelistedSPrimeContracts.length; i++) {
            uint256 sPrimeDollarValue = whitelistedSPrimeContracts[i].getUserDepositDollarValue(userAddress);
            uint256 fullyVestedToTotalBalanceRatio = whitelistedSPrimeContracts[i].getFullyVestedLockedBalanceToNonVestedRatio(userAddress); // potentially sPrime can already return fully vested an non vested dollar value or token amounts
            fullyVestedToTotalBalanceRatio = fullyVestedToTotalBalanceRatio >= 1e18 ? 1e18 : fullyVestedToTotalBalanceRatio;
            fullyVestedDollarValue += sPrimeDollarValue * fullyVestedToTotalBalanceRatio / 1e18;
            nonVestedDollarValue += sPrimeDollarValue * (1e18 - fullyVestedToTotalBalanceRatio) / 1e18;
        }
        return (fullyVestedDollarValue, nonVestedDollarValue);
    }

    function getUserSPrimeDollarValue(address userAddress) public view returns (uint256 totalDollarValue) {
        uint256 totalDollarValue = 0;
        for (uint i = 0; i < whitelistedSPrimeContracts.length; i++) {
            uint256 sPrimeDollarValue = whitelistedSPrimeContracts[i].getUserDepositDollarValue(userAddress);
            totalDollarValue += sPrimeDollarValue;
        }
        return totalDollarValue;
    }

    function getBorrowerVPrimePairsCount(address userAddress) public view returns (uint256){
        uint256 userBorrowedDollarValue = getUserBorrowedDollarValueAcrossWhitelistedPools(userAddress);
        (uint256 userSPrimeDollarValueFullyVested, uint256 userSPrimeDollarValueNonVested) = getUserSPrimeDollarValueVestedAndNonVested(userAddress);
        uint256 borrowerVPrimePairsCount = Math.min
            (userBorrowedDollarValue / 10,
            (userSPrimeDollarValueFullyVested + userSPrimeDollarValueNonVested)
        ) / 1e18;
        return borrowerVPrimePairsCount;
    }

    function getBorrowerVPrimeRateAndMaxCap(address userAddress) public view returns (int256, uint256){
        uint256 vPrimePairsCount = getBorrowerVPrimePairsCount(userAddress);
        uint256 vPrimeMaxCap = vPrimePairsCount * BORROWER_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
        uint256 currentVPrimeBalance = vPrimeContract.balanceOf(userAddress);
        int256 vPrimeRate = int256(vPrimeMaxCap) - int256(currentVPrimeBalance);
        if(vPrimeRate < 0){
            vPrimeRate = vPrimeRate / int256(V_PRIME_DETERIORATION_DAYS) / 1 days;
        } else{
            vPrimeRate = vPrimeRate / int256(MAX_V_PRIME_VESTING_YEARS) / 365 days;
        }
        return (vPrimeRate, vPrimeMaxCap);
    }

    /*
    * For every $10 deposited and $1 $sPRIME staked into one of DeltaPrime’s liquidity pools, your balance increases with 5 $vPRIME per year.
    * Only full 10-1 pairs can produce $vPRIME.
    */
    function getDepositorVPrimePairsCount(address userAddress) public view returns (uint256 depositVestedPairsCount, uint256 depositNonVestedPairsCount){
        (uint256 userDepositFullyVestedDollarValue, uint256 userDepositNonVestedDollarValue) = getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(userAddress);
        (uint256 userSPrimeDollarValueFullyVested, uint256 userSPrimeDollarValueNonVested) = getUserSPrimeDollarValueVestedAndNonVested(userAddress);
        uint256 depositVestedPairsCount = Math.min(userDepositFullyVestedDollarValue / 10, userSPrimeDollarValueFullyVested) / 1e18;
        uint256 depositNonVestedPairsCount = Math.min(userDepositNonVestedDollarValue / 10, userSPrimeDollarValueNonVested) / 1e18;
        return (depositVestedPairsCount, depositNonVestedPairsCount);
    }

    function getDepositorVPrimeRateAndMaxCap(address userAddress) public view returns (int256, uint256, uint256){
        (uint256 vPrimePairsCountVested, uint256 vPrimePairsCountNonVested) = getDepositorVPrimePairsCount(userAddress);

        uint256 vPrimeMaxCap = (vPrimePairsCountVested + vPrimePairsCountNonVested) * DEPOSITOR_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
        uint256 alreadyVestedVPrimeBalance = vPrimePairsCountVested * DEPOSITOR_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
        uint256 currentVPrimeBalance = vPrimeContract.balanceOf(userAddress);
        bool balanceShouldBeReplaced = false;
        if(currentVPrimeBalance < alreadyVestedVPrimeBalance){
            currentVPrimeBalance = alreadyVestedVPrimeBalance;
            balanceShouldBeReplaced = true;
        }
        int256 vPrimeRate = int256(vPrimeMaxCap) - int256(currentVPrimeBalance);
        if(vPrimeRate < 0){
            vPrimeRate = vPrimeRate / int256(V_PRIME_DETERIORATION_DAYS) / 1 days;
        } else {
            vPrimeRate = vPrimeRate / int256(MAX_V_PRIME_VESTING_YEARS) / 365 days;
        }
        if(balanceShouldBeReplaced){
            return (vPrimeRate, vPrimeMaxCap, alreadyVestedVPrimeBalance);
        } else {
            return (vPrimeRate, vPrimeMaxCap, 0);
        }
    }


    // EVENTS
    event WhitelistedPoolsUpdated(IPool[] newWhitelistedPools, address userAddress, uint256 timestamp);
    event WhitelistedSPrimeContractsUpdated(SPrimeMock[] newWhitelistedSPrimeContracts, address userAddress, uint256 timestamp);
    event TokenManagerUpdated(ITokenManager newTokenManager, address userAddress, uint256 timestamp);
}
