// SPDX-License-Identifier: BUSL-1.1
// Last deployed from commit: ;
pragma solidity ^0.8.17;

import "@redstone-finance/evm-connector/contracts/core/RedstoneConsumerNumericBase.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "../abstract/PendingOwnableUpgradeable.sol";
import "../interfaces/ITokenManager.sol";
import "../interfaces/IBorrowersRegistry.sol";
import "../interfaces/facets/IOwnershipFacet.sol";
import "../interfaces/IPool.sol";
import "../interfaces/ISPrime.sol";
import "./vPrime.sol";
import "../lib/uniswap-v3/FullMath.sol";

abstract contract vPrimeController is PendingOwnableUpgradeable, RedstoneConsumerNumericBase {
    ISPrime[] public whitelistedSPrimeContracts;
    ITokenManager public tokenManager;
    vPrime public vPrimeContract;
    IBorrowersRegistry public borrowersRegistry;
    bool public useOraclePrimeFeed;
    uint256 public constant BORROWER_YEARLY_V_PRIME_RATE = 1;
    uint256 public constant DEPOSITOR_YEARLY_V_PRIME_RATE = 5;
    uint256 public constant MAX_V_PRIME_VESTING_YEARS = 3;
    uint256 public constant V_PRIME_DETERIORATION_DAYS = 14;
    uint256 public constant V_PRIME_PAIR_RATIO = 10;
    uint256 public constant RS_PRICE_PRECISION_1e18_COMPLEMENT = 1e10;

    /* ========== INITIALIZER ========== */

    function initialize(ISPrime[] memory _whitelistedSPrimeContracts, ITokenManager _tokenManager, vPrime _vPrime, bool _useOraclePrimeFeed) external initializer {
        whitelistedSPrimeContracts = _whitelistedSPrimeContracts;
        tokenManager = _tokenManager;
        vPrimeContract = _vPrime;
        useOraclePrimeFeed = _useOraclePrimeFeed;
        __PendingOwnable_init();
    }


    /* ========== MUTATIVE EXTERNAL FUNCTIONS ========== */

    // Depositors and borrowers follow different vPrime accrual rules.
    // If a given address is a PrimeAccount or a PrimeAccount owner, then his vPrime balance will counted as a borrower.
    // For depositors (which get a higher vPrime accrual rate) it is advised to use wallets that are not PrimeAccount owners.
    function updateVPrimeSnapshot(address userAddress) public {
        int256 vPrimeRate;
        uint256 vPrimeMaxCap;
        if(borrowersRegistry.canBorrow(userAddress)){   // It's a PrimeAccount
            (vPrimeRate, vPrimeMaxCap) = getBorrowerVPrimeRateAndMaxCap(userAddress);
            vPrimeContract.adjustRateAndCap(userAddress, vPrimeRate, vPrimeMaxCap);
        } else if(borrowersRegistry.getLoanForOwner(userAddress) != address(0)){ // It's a PrimeAccount owner
            address primeAccountAddress = borrowersRegistry.getLoanForOwner(userAddress);
            (vPrimeRate, vPrimeMaxCap) = getBorrowerVPrimeRateAndMaxCap(primeAccountAddress);
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


    function updateVPrimeSnapshotsForAccounts(address[] memory accounts) public {
        for (uint i = 0; i < accounts.length; i++) {
            updateVPrimeSnapshot(accounts[i]);
        }
    }


    /* ========== SETTERS ========== */

    function getWhitelistedPools() public view returns (IPool[] memory) {
        bytes32[] memory poolsTokenSymbols = tokenManager.getAllPoolAssets();
        IPool[] memory whitelistedPools = new IPool[](poolsTokenSymbols.length);
        for (uint i = 0; i < poolsTokenSymbols.length; i++) {
            whitelistedPools[i] = IPool(tokenManager.getPoolAddress(poolsTokenSymbols[i]));
        }
        return whitelistedPools;
    }

    /**
    * @notice Updates the list of whitelisted sPrime contracts.
    * @dev Can only be called by the contract owner.
    * @param newWhitelistedSPrimeContracts An array of addresses representing the new list of whitelisted sPrime contracts.
    */
    function updateWhitelistedSPrimeContracts(ISPrime[] memory newWhitelistedSPrimeContracts) external onlyOwner {
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

    // only owner setter for useOraclePriceFeed
    function setUseOraclePrimeFeed(bool _useOraclePrimeFeed) external onlyOwner {
        useOraclePrimeFeed = _useOraclePrimeFeed;
        emit UseOraclePrimeFeedUpdated(_useOraclePrimeFeed, msg.sender, block.timestamp);
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

    function getPoolsPrices(IPool[] memory whitelistedPools) internal view returns (uint256[] memory) {
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        return getOracleNumericValuesFromTxMsg(poolsTokenSymbols);
    }

    function getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(address userAddress) public view returns (uint256 fullyVestedDollarValue, uint256 nonVestedDollarValue) {
        fullyVestedDollarValue = 0;
        nonVestedDollarValue = 0;
        IPool[] memory whitelistedPools = getWhitelistedPools();
        uint256[] memory prices = getPoolsPrices(whitelistedPools);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 fullyVestedBalance = whitelistedPools[i].getFullyVestedLockedBalance(userAddress);
            uint256 nonVestedBalance = IERC20(whitelistedPools[i]).balanceOf(userAddress) - fullyVestedBalance;

            uint256 _denominator = 10 ** whitelistedPools[i].decimals();
            fullyVestedDollarValue += FullMath.mulDiv(fullyVestedBalance, prices[i] * RS_PRICE_PRECISION_1e18_COMPLEMENT, _denominator);
            nonVestedDollarValue += FullMath.mulDiv(nonVestedBalance, prices[i] * RS_PRICE_PRECISION_1e18_COMPLEMENT, _denominator);
        }
        return (fullyVestedDollarValue, nonVestedDollarValue);
    }

    function getPrimeAccountBorrowedDollarValueAcrossWhitelistedPools(address primeAccountAddress) public view returns (uint256) {
        uint256 totalDollarValue = 0;
        IPool[] memory whitelistedPools = getWhitelistedPools();
        bytes32[] memory poolsTokenSymbols = new bytes32[](whitelistedPools.length);
        for (uint i = 0; i < whitelistedPools.length; i++) {
            poolsTokenSymbols[i] = tokenManager.tokenAddressToSymbol(whitelistedPools[i].tokenAddress());
        }
        uint256[] memory prices = getOracleNumericValuesFromTxMsg(poolsTokenSymbols);

        for (uint i = 0; i < whitelistedPools.length; i++) {
            uint256 poolBorrowedAmount = whitelistedPools[i].getBorrowed(primeAccountAddress);
            uint256 poolDollarValue = FullMath.mulDiv(poolBorrowedAmount, prices[i] * RS_PRICE_PRECISION_1e18_COMPLEMENT, 10 ** whitelistedPools[i].decimals());
            totalDollarValue += poolDollarValue;
        }
        return totalDollarValue;
    }

    function getPrimeTokenPoolPrice(ISPrime sPrimeContract, uint256 tokenYPrice) public view returns (uint256) {
        if(useOraclePrimeFeed){
            bytes32 primeSymbol = "PRIME";
            uint256 primePrice = getOracleNumericValueFromTxMsg(primeSymbol);
            return primePrice * 1e8 / tokenYPrice; // both tokenYPrice and primePrice have 8 decimals
        } else {
            uint256 poolPrice = sPrimeContract.getPoolPrice(); // returns price with 8 decimals
            if(poolPrice * tokenYPrice / 1e8 > 13125 * 1e5){ // 13.125 with 8 decimals which comes from 10xinitialPrice MAX PRICE CAP before oracle feed will be ready
                poolPrice = 13125 * 1e13 / tokenYPrice; // 13125 * 1e5 * 1e8 / tokenYPrice
            }
            return poolPrice;
        }
    }

    function getUserSPrimeDollarValueVestedAndNonVested(address userAddress) public view returns (uint256 fullyVestedDollarValue, uint256 nonVestedDollarValue) {
        fullyVestedDollarValue = 0;
        nonVestedDollarValue = 0;
        for (uint i = 0; i < whitelistedSPrimeContracts.length; i++) {
            bytes32 sPrimeTokenYSymbol = tokenManager.tokenAddressToSymbol(address(whitelistedSPrimeContracts[i].getTokenY()));
            uint256 sPrimeTokenYDecimals = IERC20Metadata(address(whitelistedSPrimeContracts[i].getTokenY())).decimals();
            uint256 sPrimeTokenYPrice = getOracleNumericValueFromTxMsg(sPrimeTokenYSymbol);
            uint256 poolPrice = getPrimeTokenPoolPrice(whitelistedSPrimeContracts[i], sPrimeTokenYPrice);
            uint256 sPrimeBalance = IERC20Metadata(address(whitelistedSPrimeContracts[i])).balanceOf(userAddress);
            uint256 fullyVestedBalance = whitelistedSPrimeContracts[i].getFullyVestedLockedBalance(userAddress);
            uint256 nonVestedBalance = sPrimeBalance - fullyVestedBalance;
            uint256 userSPrimeValueInTokenY = whitelistedSPrimeContracts[i].getUserValueInTokenY(userAddress, poolPrice);
            if(sPrimeBalance > 0) {
                uint256 _denominator = sPrimeBalance * 10 ** sPrimeTokenYDecimals;
                fullyVestedDollarValue += FullMath.mulDiv(userSPrimeValueInTokenY, sPrimeTokenYPrice * RS_PRICE_PRECISION_1e18_COMPLEMENT * fullyVestedBalance, _denominator);
                nonVestedDollarValue += FullMath.mulDiv(userSPrimeValueInTokenY, sPrimeTokenYPrice * RS_PRICE_PRECISION_1e18_COMPLEMENT * nonVestedBalance, _denominator);
            }
        }
        return (fullyVestedDollarValue, nonVestedDollarValue);
    }

    function getBorrowerVPrimePairsCount(address primeAccountAddress) public view returns (uint256){
        uint256 primeAccountBorrowedDollarValue = getPrimeAccountBorrowedDollarValueAcrossWhitelistedPools(primeAccountAddress);
        address primeAccountOwner = IOwnershipFacet(primeAccountAddress).owner();
        (uint256 userSPrimeDollarValueFullyVested, uint256 userSPrimeDollarValueNonVested) = getUserSPrimeDollarValueVestedAndNonVested(primeAccountOwner);
        uint256 borrowerVPrimePairsCount = Math.min
            (primeAccountBorrowedDollarValue / V_PRIME_PAIR_RATIO,
            (userSPrimeDollarValueFullyVested + userSPrimeDollarValueNonVested)
        ) / 1e18;
        return borrowerVPrimePairsCount;
    }

    function getBorrowerVPrimeRateAndMaxCap(address primeAccountAddress) public view returns (int256, uint256){
        uint256 vPrimePairsCount = getBorrowerVPrimePairsCount(primeAccountAddress);
        uint256 vPrimeMaxCap = vPrimePairsCount * BORROWER_YEARLY_V_PRIME_RATE * MAX_V_PRIME_VESTING_YEARS * 1e18;
        uint256 currentVPrimeBalance = vPrimeContract.balanceOf(primeAccountAddress);
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
    * Only full ${V_PRIME_PAIR_RATIO}-1 pairs can produce $vPRIME.
    */
    function getDepositorVPrimePairsCount(address userAddress) public view returns (uint256 depositVestedPairsCount, uint256 depositNonVestedPairsCount){
        (uint256 userDepositFullyVestedDollarValue, uint256 userDepositNonVestedDollarValue) = getUserDepositDollarValueAcrossWhiteListedPoolsVestedAndNonVested(userAddress);
        (uint256 userSPrimeDollarValueFullyVested, uint256 userSPrimeDollarValueNonVested) = getUserSPrimeDollarValueVestedAndNonVested(userAddress);
        uint256 depositVestedPairsCount = Math.min(userDepositFullyVestedDollarValue / V_PRIME_PAIR_RATIO, userSPrimeDollarValueFullyVested) / 1e18;
        uint256 depositNonVestedPairsCount = Math.min(userDepositNonVestedDollarValue / V_PRIME_PAIR_RATIO, userSPrimeDollarValueNonVested) / 1e18;
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
    event WhitelistedSPrimeContractsUpdated(ISPrime[] newWhitelistedSPrimeContracts, address userAddress, uint256 timestamp);
    event TokenManagerUpdated(ITokenManager newTokenManager, address userAddress, uint256 timestamp);
    event UseOraclePrimeFeedUpdated(bool _useOraclePrimeFeed, address userAddress, uint256 timestamp);
}
